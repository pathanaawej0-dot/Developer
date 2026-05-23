import { kill } from "node:process";
import type { ToolHandler } from "./registry.js";
import type { SessionManager } from "./session-manager.js";
import { createSessionManager } from "./session-manager.js";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function createProcessTool(manager?: SessionManager): ToolHandler {
  const sessionManager = manager ?? createSessionManager();

  return {
    name: "process",
    description:
      "Manage background process sessions. Actions: list (all sessions), poll (drain new output), log (paginated output), write (stdin), kill (terminate), clear (remove finished).",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "poll", "log", "write", "kill", "clear"],
          description: "The process operation to perform",
        },
        sessionId: {
          type: "string",
          description: "Session ID (required for poll, log, write, kill, clear)",
        },
        data: {
          type: "string",
          description: "Data to write to stdin (required for write action)",
        },
        eof: {
          type: "boolean",
          description: "Close stdin after writing (optional, for write action)",
        },
        offset: {
          type: "number",
          description: "Line offset for log action",
        },
        limit: {
          type: "number",
          description: "Line limit for log action",
        },
      },
      required: ["action"],
    },
    async execute(args) {
      const action = String(args.action ?? "");
      const sessionId = args.sessionId ? String(args.sessionId) : "";

      switch (action) {
        case "list": {
          const sessions = sessionManager.getAllSessions();
          const items = Array.from(sessions.entries()).map(([id, s]) => ({
            sessionId: id,
            command: s.command,
            status: s.finished ? "finished" : "running",
            duration: formatDuration(Date.now() - s.startTime),
          }));
          return JSON.stringify(items, null, 2);
        }

        case "poll": {
          if (!sessionId) return "Error: sessionId is required";
          const session = sessionManager.getSession(sessionId);
          if (!session) return `Error: session not found: ${sessionId}`;
          const newOutput = session.output.slice(session.lastPollIndex).join("");
          session.lastPollIndex = session.output.length;
          const result = {
            output: newOutput,
            finished: session.finished,
            exitCode: session.exitCode,
          };
          return JSON.stringify(result, null, 2);
        }

        case "log": {
          if (!sessionId) return "Error: sessionId is required";
          const session = sessionManager.getSession(sessionId);
          if (!session) return `Error: session not found: ${sessionId}`;
          const allLines = session.output.join("").split("\n");
          const offset = args.offset ? Number(args.offset) : undefined;
          const limit = args.limit ? Number(args.limit) : undefined;

          let slice: string[];
          if (offset !== undefined) {
            const start = offset;
            const end = limit !== undefined ? start + limit : undefined;
            slice = allLines.slice(start, end);
          } else {
            slice = allLines.slice(-200);
          }

          let result = slice.join("\n");
          const total = allLines.length;
          if (offset === undefined && total > 200) {
            result += `\n--- ${total} total lines, showing last 200. Use offset/limit to page ---`;
          }
          return result || "(empty)";
        }

        case "write": {
          if (!sessionId) return "Error: sessionId is required";
          const session = sessionManager.getSession(sessionId);
          if (!session) return `Error: session not found: ${sessionId}`;
          const data = String(args.data ?? "");
          const eof = args.eof === true;
          session.process.stdin?.write(data);
          if (eof) {
            session.process.stdin?.end();
          }
          return `Sent ${Buffer.byteLength(data, "utf-8")} bytes`;
        }

        case "kill": {
          if (!sessionId) return "Error: sessionId is required";
          const session = sessionManager.getSession(sessionId);
          if (!session) return `Error: session not found: ${sessionId}`;
          session.process.kill("SIGTERM");
          setTimeout(() => {
            if (!session.finished) {
              session.process.kill("SIGKILL");
            }
          }, 3000);
          return `Killed session ${sessionId}`;
        }

        case "clear": {
          if (!sessionId) return "Error: sessionId is required";
          const session = sessionManager.getSession(sessionId);
          if (!session) return `Error: session not found: ${sessionId}`;
          if (!session.finished) return `Error: session ${sessionId} is still running, kill it first`;
          sessionManager.removeSession(sessionId);
          return `Cleared session ${sessionId}`;
        }

        default:
          return `Unknown action: ${action}`;
      }
    },
  };
}
