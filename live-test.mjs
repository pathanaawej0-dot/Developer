import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createEventBus } from "./src/event-bus/index.js";
import { createSessionStore } from "./src/session-store/index.js";
import { createToolRegistry } from "./src/tools/registry.js";
import { createFileTool } from "./src/tools/file.js";
import { createProvider } from "./src/agent/provider.js";
import { createAgent } from "./src/agent/loop.js";

const envRaw = readFileSync(".env.local", "utf-8");
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      process.env[key] = val;
    }
  }
}

const workspace = mkdtempSync(join(tmpdir(), "live-test-"));
console.log(`\n=== LIVE TEST ===`);
console.log(`Workspace: ${workspace}`);

writeFileSync(join(workspace, "readme.md"), "# Test Workspace\n\nThis is a test file for the agent.\n");

const eventBus = createEventBus();
const store = createSessionStore(workspace);
const session = await store.createSession();
const registry = createToolRegistry();
registry.register(createFileTool({ allowedPath: workspace }));

const provider = createProvider();

eventBus.subscribe("agent:token", (p) => process.stdout.write(p.token));
eventBus.subscribe("tool:start", (p) => console.log(`\n[TOOL START] ${p.tool}(${JSON.stringify(p.args)})`));
eventBus.subscribe("tool:end", (p) => console.log(`\n[TOOL END] ${p.tool} => ${String(p.result).slice(0, 200)}`));
eventBus.subscribe("agent:done", () => console.log(`\n[DONE]`));
eventBus.subscribe("error", (p) => console.log(`\n[ERROR] ${p.error.message}`));

const agent = createAgent({
  provider,
  eventBus,
  sessionStore: store,
  sessionId: session.id,
  registry,
  maxTurns: 10,
});

const prompt = "read readme.md and write output.md with your summary";

console.log(`\nPrompt: ${prompt}`);
console.log(`---`);

await agent.run(prompt);

const sessionData = await store.loadSession(session.id);
console.log(`\n\n=== SESSION MESSAGES (${sessionData.messages.length}) ===`);
for (const m of sessionData.messages) {
  const role = m.role.padEnd(10);
  const content = m.content ? m.content.slice(0, 300) : "(empty)";
  const tool = m.name ? ` [${m.name}]` : "";
  console.log(`  ${role}${tool}: ${content}`);
}

console.log(`\n=== WORKSPACE FILES (${workspace}) ===`);
for (const f of readdirSync(workspace)) {
  if (f.endsWith(".json")) continue;
  const path = join(workspace, f);
  const size = readFileSync(path).length;
  const text = readFileSync(path, "utf-8").trim().slice(0, 200);
  console.log(`  ${f} (${size}b): ${text}`);
}
console.log(`\n`);
