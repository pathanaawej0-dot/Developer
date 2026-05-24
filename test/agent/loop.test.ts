import { describe, it, expect, vi } from "vitest";
import { createEventBus } from "../../src/event-bus/index.js";
import { createSessionStore } from "../../src/session-store/index.js";
import { createToolRegistry } from "../../src/tools/registry.js";
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

  it("dispatches tool calls and saves results", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    const registry = createToolRegistry();

    registry.register({
      name: "greeter",
      description: "Say hello",
      parameters: { type: "object", properties: { name: { type: "string" } } },
      async execute(args) {
        return `Hello, ${args.name}!`;
      },
    });

    const callCount = vi.fn();
    const provider: Provider = {
      async stream(
        _messages: ChatCompletionMessageParam[],
        callbacks?: StreamCallbacks,
        _tools?: unknown[],
      ) {
        callCount();
        return {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [{
            id: "call_1",
            type: "function",
            function: { name: "greeter", arguments: '{"name": "World"}' },
          }],
        };
      },
    };

    const toolResults: string[] = [];
    eventBus.subscribe("tool:end", (p) => toolResults.push(String(p.result)));

    const agent = createAgent({
      provider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
      registry,
      maxTurns: 3,
    });
    await agent.run("say hello");

    const loaded = await store.loadSession(session.id);
    const msgs = loaded.messages;
    expect(msgs[0]).toMatchObject({ role: "user", content: "say hello" });
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "" });
    expect(msgs[2]).toMatchObject({ role: "tool", content: "Hello, World!" });
  });

  it("trims messages and retries on context overflow error", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    let callCount = 0;

    const overflowingProvider: Provider = {
      async stream() {
        callCount++;
        if (callCount === 1) {
          throw new Error("This model's maximum context length is 32768 tokens. Reduce the number of messages.");
        }
        return { content: "Success after retry", finishReason: "stop" };
      },
    };

    const agent = createAgent({
      provider: overflowingProvider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
    });

    await agent.run("test prompt");

    expect(callCount).toBe(2);
    const loaded = await store.loadSession(session.id);
    expect(loaded.messages[1]).toMatchObject({ role: "assistant", content: "Success after retry" });
  });

  it("stops after second consecutive context overflow error", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    let callCount = 0;

    const failingProvider: Provider = {
      async stream() {
        callCount++;
        throw new Error("This model's maximum context length is 32768 tokens. Reduce the number of messages.");
      },
    };

    const errors: Error[] = [];
    eventBus.subscribe("error", (p) => errors.push(p.error));

    const agent = createAgent({
      provider: failingProvider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
    });

    await agent.run("test prompt");

    expect(callCount).toBe(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("context length");
  });

  it("does not crash on provider error, emits error event instead", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();

    const errorProvider: Provider = {
      async stream() {
        throw new Error("Provider failure");
      },
    };

    const errors: Error[] = [];
    eventBus.subscribe("error", (p) => errors.push(p.error));

    const agent = createAgent({
      provider: errorProvider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
    });

    await agent.run("test prompt");

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Provider failure");
  });

  it("executes multiple parallel tool calls concurrently", async () => {
    const eventBus = createEventBus();
    const store = createSessionStore(tmpDir());
    const session = await store.createSession();
    const registry = createToolRegistry();
    let callCount = 0;

    registry.register({
      name: "echo",
      description: "Echo",
      parameters: { type: "object", properties: { msg: { type: "string" } } },
      async execute(args) {
        return String(args.msg ?? "");
      },
    });

    const provider: Provider = {
      async stream(
        _messages: ChatCompletionMessageParam[],
        _callbacks?: StreamCallbacks,
        _tools?: unknown[],
      ) {
        callCount++;
        if (callCount > 1) {
          return { content: "done", finishReason: "stop" };
        }
        return {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [
            { id: "c1", type: "function", function: { name: "echo", arguments: '{"msg":"a"}' } },
            { id: "c2", type: "function", function: { name: "echo", arguments: '{"msg":"b"}' } },
          ],
        };
      },
    };

    const agent = createAgent({
      provider,
      eventBus,
      sessionStore: store,
      sessionId: session.id,
      registry,
    });
    await agent.run("do two things");

    const loaded = await store.loadSession(session.id);
    const toolMsgs = loaded.messages.filter((m) => m.role === "tool");
    expect(toolMsgs).toHaveLength(2);
  });
});
