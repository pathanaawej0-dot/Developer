#!/usr/bin/env node
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createEventBus } from "../src/event-bus/index.js";
import { createSessionStore } from "../src/session-store/index.js";
import { createToolRegistry } from "../src/tools/registry.js";
import { createFileTool } from "../src/tools/file.js";
import { createBashTool } from "../src/tools/bash.js";
import { createProcessTool } from "../src/tools/process.js";
import { createSessionManager } from "../src/tools/session-manager.js";
import { createAgent } from "../src/agent/loop.js";
import { createProvider } from "../src/agent/provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getApiKey(): string {
  const fromEnv = process.env.KILO_API_KEY;
  if (fromEnv) return fromEnv;
  const envPath = resolve(__dirname, "../.env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8").trim();
    const match = content.match(/^KILO_API_KEY=(.+)$/m);
    if (match) return match[1];
  }
  console.error("KILO_API_KEY not found. Set it in .env.local or as an environment variable.");
  process.exit(1);
}

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error("Usage: pnpm agent <prompt>");
    console.error('Example: pnpm agent "write a file called hello.txt with content \'Hello\'"');
    process.exit(1);
  }

  const startTime = Date.now();
  let tokenCount = 0;

  const SEP = "━".repeat(50);

  console.log(`\n${SEP}`);
  console.log("  Agent Test Run");
  console.log(`${SEP}\n`);
  console.log(`Prompt: ${prompt}\n`);

  const apiKey = getApiKey();
  const workspace = mkdtempSync(join(tmpdir(), "agent-test-"));

  const eventBus = createEventBus();
  const store = createSessionStore(workspace);
  const session = await store.createSession();
  const registry = createToolRegistry();
  const sessionManager = createSessionManager();

  registry.register(createFileTool({ allowedPath: workspace }));
  registry.register(createBashTool(sessionManager));
  registry.register(createProcessTool(sessionManager));

  eventBus.subscribe("agent:token", (p: { token: string }) => {
    process.stdout.write(p.token);
    tokenCount++;
  });

  eventBus.subscribe("tool:start", (p: { tool: string; args: unknown }) => {
    console.log(`\n[TOOL:START] ${p.tool}`);
    console.log(`  Args: ${formatJson(p.args)}`);
  });

  eventBus.subscribe("tool:end", (p: { tool: string; result: string }) => {
    const result = typeof p.result === "string" ? p.result.slice(0, 300) : formatJson(p.result).slice(0, 300);
    console.log(`[TOOL:END]   ${p.tool} ✓`);
    if (result) {
      for (const line of result.split("\n")) {
        console.log(`  ${line}`);
      }
    }
  });

  eventBus.subscribe("agent:thinking", () => {
    console.log("[THINKING] Processing...\n");
  });

  eventBus.subscribe("agent:done", () => {
    console.log("\n\n[DONE]");
  });

  eventBus.subscribe("error", (p: { error: Error }) => {
    console.error(`\n[ERROR] ${p.error.message}`);
  });

  const provider = createProvider({ apiKey });
  const agent = createAgent({ provider, eventBus, sessionStore: store, sessionId: session.id, registry });

  try {
    await agent.run(prompt);
  } catch (err) {
    console.error(`\n[FATAL] ${err instanceof Error ? err.message : String(err)}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${SEP}`);
  console.log("  Summary");
  console.log(`${SEP}`);
  console.log(`  Tokens:    ${tokenCount}`);
  console.log(`  Duration:  ${duration}s`);
  console.log(`  Workspace: ${workspace}`);
  console.log(`${SEP}\n`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
