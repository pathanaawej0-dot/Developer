import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

const SHELL = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
const SHELL_FLAG = process.platform === "win32" ? "/c" : "-c";

export interface ProcessState {
  process: ChildProcess;
  command: string;
  output: string[];
  finished: boolean;
  exitCode: number | null;
  startTime: number;
  lastPollIndex: number;
}

export interface SessionManager {
  createSession(command: string, workdir?: string, env?: Record<string, string>): string;
  getSession(id: string): ProcessState | undefined;
  getAllSessions(): Map<string, ProcessState>;
  removeSession(id: string): boolean;
}

export function createSessionManager(): SessionManager {
  const sessions = new Map<string, ProcessState>();
  let counter = 0;

  return {
    createSession(command, workdir, env) {
      counter++;
      const sessionId = `bg-${counter}`;
      const childEnv = { ...process.env, DEVELOPER_SHELL: "bash", ...(env ?? {}) };
      const child = spawn(SHELL, [SHELL_FLAG, command], {
        cwd: workdir,
        env: childEnv,
        shell: false,
      });

      const state: ProcessState = {
        process: child,
        command,
        output: [],
        finished: false,
        exitCode: null,
        startTime: Date.now(),
        lastPollIndex: 0,
      };

      child.stdout?.on("data", (data: Buffer) => {
        state.output.push(data.toString());
      });

      child.stderr?.on("data", (data: Buffer) => {
        state.output.push(data.toString());
      });

      child.on("close", (code) => {
        state.finished = true;
        state.exitCode = code;
      });

      sessions.set(sessionId, state);
      return sessionId;
    },

    getSession(id) {
      return sessions.get(id);
    },

    getAllSessions() {
      return sessions;
    },

    removeSession(id) {
      return sessions.delete(id);
    },
  };
}
