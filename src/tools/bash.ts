import { spawn } from "node:child_process";
import type { ToolHandler } from "./registry.js";
import type { SessionManager } from "./session-manager.js";
import { createSessionManager } from "./session-manager.js";

const SHELL = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
const SHELL_FLAG = process.platform === "win32" ? "/c" : "-c";

async function foregroundCmd(command: string, workdir?: string, env?: Record<string, string>, timeout?: number): Promise<string> {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, DEVELOPER_SHELL: "bash", ...(env ?? {}) };
    const child = spawn(SHELL, [SHELL_FLAG, command], {
      cwd: workdir,
      env: childEnv,
      shell: false,
    });

    let output = "";
    let completed = false;

    const timer = timeout && timeout > 0
      ? setTimeout(() => {
          if (!completed) {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!completed) child.kill("SIGKILL");
            }, 3000);
          }
        }, timeout)
      : undefined;

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      completed = true;
      if (timer) clearTimeout(timer);
      if (output.length > 10000) {
        output = output.slice(0, 10000) + "\n[output truncated]";
      }
      resolve(`[exit code: ${code ?? -1}]\n${output}`);
    });

    child.on("error", (err) => {
      completed = true;
      if (timer) clearTimeout(timer);
      resolve(`[exit code: 1]\n${err.message}`);
    });
  });
}

function backgroundCmd(manager: SessionManager, command: string, workdir?: string, env?: Record<string, string>): string {
  const sessionId = manager.createSession(command, workdir, env);
  return `[background: ${sessionId}]`;
}

export function createBashTool(manager?: SessionManager): ToolHandler {
  const sessionManager = manager ?? createSessionManager();

  return {
    name: "bash",
    description:
      "Run shell commands. Use action 'foreground' to run a command and wait for it to complete. Use action 'background' to start a command and return immediately with a sessionId for the process tool. Use yieldMs to auto-background long-running commands.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["foreground", "background"],
          description: "Whether to run in foreground (wait for exit) or background (return immediately)",
        },
        command: {
          type: "string",
          description: "The shell command to run (required)",
        },
        workdir: {
          type: "string",
          description: "Working directory for the command",
        },
        env: {
          type: "object",
          description: "Additional environment variables",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default 1800000)",
        },
        yieldMs: {
          type: "number",
          description: "Auto-background after this many milliseconds if still running",
        },
      },
      required: ["action", "command"],
    },
    async execute(args) {
      const action = String(args.action ?? "");
      const command = String(args.command ?? "");
      if (!command) return "[exit code: 1]\nNo command provided";

      const workdir = args.workdir ? String(args.workdir) : undefined;
      const env = args.env as Record<string, string> | undefined;
      const timeout = args.timeout ? Number(args.timeout) : undefined;
      const yieldMs = args.yieldMs ? Number(args.yieldMs) : undefined;

      switch (action) {
        case "foreground": {
          if (yieldMs && yieldMs > 0) {
            return foregroundWithAutoBg(sessionManager, command, workdir, env, timeout, yieldMs);
          }
          return foregroundCmd(command, workdir, env, timeout);
        }
        case "background":
          return backgroundCmd(sessionManager, command, workdir, env);
        default:
          return `[exit code: 1]\nUnknown action: ${action}`;
      }
    },
  };
}

async function foregroundWithAutoBg(
  manager: SessionManager,
  command: string,
  workdir?: string,
  env?: Record<string, string>,
  timeout?: number,
  yieldMs?: number,
): Promise<string> {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, DEVELOPER_SHELL: "bash", ...(env ?? {}) };
    const child = spawn(SHELL, [SHELL_FLAG, command], {
      cwd: workdir,
      env: childEnv,
      shell: false,
    });

    let output = "";
    let completed = false;
    let detached = false;
    let sessionId: string | null = null;

    const yieldTimer = yieldMs && yieldMs > 0
      ? setTimeout(() => {
          if (!completed && !detached) {
            detached = true;
            sessionId = `auto-${Date.now()}`;
            const state: {
              process: typeof child;
              command: string;
              output: string[];
              finished: boolean;
              exitCode: number | null;
              startTime: number;
              lastPollIndex: number;
            } = {
              process: child,
              command,
              output: [],
              finished: false,
              exitCode: null,
              startTime: Date.now(),
              lastPollIndex: 0,
            };
            child.stdout?.removeAllListeners("data");
            child.stderr?.removeAllListeners("data");
            child.stdout?.on("data", (data: Buffer) => {
              state.output.push(data.toString());
            });
            child.stderr?.on("data", (data: Buffer) => {
              state.output.push(data.toString());
            });
            (manager as any).getAllSessions().set(sessionId, state);
            child.removeAllListeners("close");
            child.on("close", (code) => {
              state.finished = true;
              state.exitCode = code;
            });
            const firstPart = output.length > 200 ? output.slice(0, 200) + "..." : output;
            resolve(`[background: ${sessionId}]\n${firstPart}`);
          }
        }, yieldMs)
      : undefined;

    const timer = timeout && timeout > 0
      ? setTimeout(() => {
          if (!completed && !detached) {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!completed && !detached) child.kill("SIGKILL");
            }, 3000);
          }
        }, timeout)
      : undefined;

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (detached) return;
      completed = true;
      if (yieldTimer) clearTimeout(yieldTimer);
      if (timer) clearTimeout(timer);
      if (output.length > 10000) {
        output = output.slice(0, 10000) + "\n[output truncated]";
      }
      resolve(`[exit code: ${code ?? -1}]\n${output}`);
    });

    child.on("error", (err) => {
      if (detached) return;
      completed = true;
      if (yieldTimer) clearTimeout(yieldTimer);
      if (timer) clearTimeout(timer);
      resolve(`[exit code: 1]\n${err.message}`);
    });
  });
}

export type { SessionManager };
