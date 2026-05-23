import { describe, it, expect, vi } from "vitest";
import { createEventBus } from "../../src/event-bus/index.js";
import { createSessionStore } from "../../src/session-store/index.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAgent } from "../../src/agent/loop.js";
import type { Provider, StreamResult, StreamCallbacks } from "../../src/agent/provider.js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "agent-test-"));
}

function makeFakeProvider(result: StreamResult): Provider {
  return {
    async stream(
      _messages: ChatCompletionMessageParam[],
      callbacks?: StreamCallbacks,
      _tools?: unknown[],
    ) {
      const content = result.content;
      callbacks?.onToken?.(content);
      callbacks?.onDone?.(result);
      return result;
    },
  };
}

describe("Agent Loop", () => {
  it("sends prompt to provider and emits tokens via event bus", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    const provider = makeFakeProvider({
      content: "Hello world",
      finishReason: "stop",
    });

    const tokens: string[] = [];
    eventBus.subscribe("agent:token", (p) => tokens.push(p.token));

    const agent = createAgent({ provider, eventBus, sessionStore: store, sessionId: session.id });
    await agent.run("test prompt");

    expect(tokens).toContain("Hello world");
  });

  it("auto-saves messages after turn completes", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    const provider = makeFakeProvider({
      content: "Hello world",
      finishReason: "stop",
    });

    const agent = createAgent({ provider, eventBus, sessionStore: store, sessionId: session.id });
    await agent.run("test prompt");

    const loaded = await store.loadSession(session.id);
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]).toMatchObject({ role: "user", content: "test prompt" });
    expect(loaded.messages[1]).toMatchObject({ role: "assistant", content: "Hello world" });
  });

  it("handles finish_reason tool_calls without crashing", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    const provider = makeFakeProvider({
      content: "",
      finishReason: "tool_calls",
      toolCalls: [{
        id: "call_1",
        type: "function",
        function: { name: "read_file", arguments: '{"file": "/test.txt"}' },
      }],
    });

    const agent = createAgent({ provider, eventBus, sessionStore: store, sessionId: session.id });
    await expect(agent.run("call a tool")).resolves.toBeUndefined();

    const loaded = await store.loadSession(session.id);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]).toMatchObject({ role: "user", content: "call a tool" });
  });
});
