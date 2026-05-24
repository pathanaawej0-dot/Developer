import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { v4 as uuid } from "uuid";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

function defaultDir() {
  return join(homedir(), ".developer", "sessions");
}

export function createSessionStore(sessionsDir?: string) {
  const dir = sessionsDir ?? defaultDir();

  function ensureDir() {
    mkdirSync(dir, { recursive: true });
  }

  function pathFor(id: string) {
    return join(dir, `${id}.json`);
  }

  return {
    async createSession(): Promise<Session> {
      ensureDir();
      const now = new Date().toISOString();
      const session: Session = {
        id: uuid(),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      writeFileSync(pathFor(session.id), JSON.stringify(session, null, 2));
      return session;
    },

    async loadSession(id: string): Promise<Session> {
      const filePath = pathFor(id);
      if (!existsSync(filePath)) {
        throw new Error(`Session not found: ${id}`);
      }
      return JSON.parse(readFileSync(filePath, "utf-8")) as Session;
    },

    async appendMessages(id: string, messages: Message[]): Promise<Session> {
      const session = await this.loadSession(id);
      session.messages.push(...messages);
      session.updatedAt = new Date().toISOString();
      writeFileSync(pathFor(id), JSON.stringify(session, null, 2));
      return session;
    },

    async listSessions(): Promise<{ id: string; createdAt: string; messageCount: number }[]> {
      if (!existsSync(dir)) return [];
      const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
      return files.map((f: string) => {
        const session = JSON.parse(readFileSync(join(dir, f), "utf-8")) as Session;
        return {
          id: session.id,
          createdAt: session.createdAt,
          messageCount: session.messages.length,
        };
      });
    },

    async replaceMessages(id: string, messages: Message[]): Promise<Session> {
      const session = await this.loadSession(id);
      session.messages = messages;
      session.updatedAt = new Date().toISOString();
      writeFileSync(pathFor(id), JSON.stringify(session, null, 2));
      return session;
    },

    async deleteSession(id: string): Promise<void> {
      const filePath = pathFor(id);
      if (!existsSync(filePath)) {
        throw new Error(`Session not found: ${id}`);
      }
      unlinkSync(filePath);
    },
  };
}
