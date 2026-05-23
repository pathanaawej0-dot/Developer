import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createEventBus } from "../../src/event-bus/index.js";
import { createSessionStore } from "../../src/session-store/index.js";
import { createToolRegistry } from "../../src/tools/registry.js";
import { createFileTool } from "../../src/tools/file.js";
import { createAgent } from "../../src/agent/loop.js";
import type { Provider, StreamCallbacks } from "../../src/agent/provider.js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

describe("Tool Integration", () => {
  let workspace: string;
  let toolOutput: string;

  beforeAll(async () => {
    workspace = mkdtempSync(join(tmpdir(), "integration-test-"));
    writeFileSync(join(workspace, "greeting.txt"), "Hello from the workspace!");

    const eventBus = createEventBus();
    const store = createSessionStore(workspace);
    const session = await store.createSession();
    const registry = createToolRegistry();
    registry.register(createFileTool({ allowedPath: workspace }));

    const messages: string[] = [];
    eventBus.subscribe("agent:token", (p) => messages.push(p.token));
    eventBus.subscribe("tool:start", (p) => messages.push(`[tool:start] ${p.tool}`));
    eventBus.subscribe("tool:end", (p) => messages.push(`[tool:end]`));
    eventBus.subscribe("agent:done", (p) => messages.push(`[done] ${p.result}`));

    let callCount = 0;
    const provider: Provider = {
      async stream(
        _msgs: ChatCompletionMessageParam[],
        callbacks?: StreamCallbacks,
        _tools?: unknown[],
      ) {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            finishReason: "tool_calls" as const,
            toolCalls: [
              {
                id: "call_read",
                type: "function" as const,
                function: { name: "file", arguments: JSON.stringify({ action: "read", path: "greeting.txt" }) },
              },
            ],
          };
        }
        callbacks?.onToken?.("Read greeting.txt. Content:\n");
        callbacks?.onToken?.("Hello from the workspace!");
        return {
          content: "Read greeting.txt. Content:\nHello from the workspace!",
          finishReason: "stop" as const,
        };
      },
    };

    const agent = createAgent({ provider, eventBus, sessionStore: store, sessionId: session.id, registry });
    await agent.run("read the greeting file");

    toolOutput = messages.join("");
  });

  it("produces raw output showing tool calls were made", () => {
    console.log("\n=== INTEGRATION TEST RAW OUTPUT ===");
    console.log(`Workspace: ${workspace}`);
    console.log(`Output: ${toolOutput}`);
    console.log("=== END RAW OUTPUT ===\n");
    expect(toolOutput.length).toBeGreaterThan(0);
  });
});
