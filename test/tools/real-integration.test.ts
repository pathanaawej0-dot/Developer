import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createEventBus } from "../../src/event-bus/index.js";
import { createSessionStore } from "../../src/session-store/index.js";
import { createToolRegistry } from "../../src/tools/registry.js";
import { createFileTool } from "../../src/tools/file.js";
import { createBashTool } from "../../src/tools/bash.js";
import { createProcessTool } from "../../src/tools/process.js";
import { createSessionManager } from "../../src/tools/session-manager.js";
import { createAgent } from "../../src/agent/loop.js";
import { createProvider } from "../../src/agent/provider.js";

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(__dirname, "../../.env.local");
let KILO_API_KEY = process.env.KILO_API_KEY;
if (!KILO_API_KEY) {
  try {
    const content = readFileSync(envLocalPath, "utf-8").trim();
    const match = content.match(/^KILO_API_KEY=(.+)$/m);
    if (match) KILO_API_KEY = match[1];
  } catch {}
}

describe("Real Agent Integration", () => {
  let workspace: string;
  let logs: string[];

  beforeAll(async () => {
    workspace = mkdtempSync(join(tmpdir(), "real-integration-"));
    logs = [];

    const eventBus = createEventBus();
    const store = createSessionStore(workspace);
    const session = await store.createSession();
    const registry = createToolRegistry();
    const sessionManager = createSessionManager();

    registry.register(createFileTool({ allowedPath: workspace }));
    registry.register(createBashTool(sessionManager));
    registry.register(createProcessTool(sessionManager));

    const logEvent = (label: string, data: unknown) => {
      const line = `[${label}] ${typeof data === "string" ? data : JSON.stringify(data)}`;
      logs.push(line);
      console.log(line);
    };

    eventBus.subscribe("agent:thinking", (p) => logEvent("THINKING", p.message));
    eventBus.subscribe("agent:token", (p) => process.stdout.write(p.token));
    eventBus.subscribe("agent:done", (p) => logEvent("DONE", p.result));
    eventBus.subscribe("tool:start", (p) => logEvent("TOOL:START", `${p.tool}(${JSON.stringify(p.args)})`));
    eventBus.subscribe("tool:end", (p) => logEvent("TOOL:END", `${p.tool} => ${(p.result as string).slice(0, 200)}`));
    eventBus.subscribe("error", (p) => logEvent("ERROR", p.error.message));

    const provider = createProvider({ apiKey: KILO_API_KEY });

    const prompt = [
      "Run these steps in order:",
      "1. Create a file called 'hello.txt' with content 'Hello from bash!'",
      "2. Use bash to list files in the current directory",
      "3. Read the file hello.txt",
      "4. Edit hello.txt to replace 'bash' with 'agent'",
      "5. Read hello.txt again to confirm the edit",
      "6. Then tell me what you did",
    ].join("\n");

    console.log("\n=== PROMPT ===");
    console.log(prompt);
    console.log("=== STARTING AGENT ===\n");

    const agent = createAgent({
      provider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
      registry,
    });

    try {
      await agent.run(prompt);
    } catch (err) {
      logEvent("FATAL", err instanceof Error ? err.message : String(err));
    }

    console.log("\n=== AGENT FINISHED ===");
  }, 120_000);

  it("agent completed successfully and produced logs", () => {
    expect(logs.length).toBeGreaterThan(0);
    const allLogs = logs.join("\n");
    expect(allLogs).toContain("TOOL:START");
    expect(allLogs).toContain("DONE");
  });

  it("file hello.txt was created by the agent", () => {
    expect(existsSync(join(workspace, "hello.txt"))).toBe(true);
  });
});
