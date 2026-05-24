import { describe, it, expect, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      responses = {
        create: mockCreate,
      };
    },
  };
});

import { createProvider } from "../../src/agent/provider.js";

async function* makeStream(events: unknown[]) {
  for (const event of events) {
    yield event;
  }
}

describe("LLM Provider", () => {
  it("allows anonymous access when API key is missing", () => {
    const provider = createProvider({ apiKey: "" });
    expect(provider).toBeDefined();
    expect(provider.stream).toBeDefined();
  });

  it("streams text tokens via onToken callback", async () => {
    const tokens: string[] = [];
    const provider = createProvider({ apiKey: "test-key" });

    mockCreate.mockResolvedValue(makeStream([
      { type: "response.output_text.delta", delta: "Hello" },
      { type: "response.output_text.delta", delta: " world" },
      { type: "response.completed", response: { status: "completed" } },
    ]));

    const result = await provider.stream(
      [{ role: "user", content: "hello" }],
      { onToken: (t: string) => tokens.push(t) },
    );

    expect(tokens).toEqual(["Hello", " world"]);
    expect(result.content).toBe("Hello world");
    expect(result.finishReason).toBe("stop");
  });

  it("returns tool calls when response contains function calls", async () => {
    const provider = createProvider({ apiKey: "test-key" });

    mockCreate.mockResolvedValue(makeStream([
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { type: "function_call", name: "file", id: "call_1" },
      },
      {
        type: "response.function_call_arguments.delta",
        delta: '{"act',
        output_index: 0,
      },
      {
        type: "response.function_call_arguments.delta",
        delta: 'ion": "read", "file": "test.txt"}',
        output_index: 0,
      },
      {
        type: "response.completed",
        response: { status: "completed" },
      },
    ]));

    const result = await provider.stream(
      [{ role: "user", content: "read file test.txt" }],
    );

    expect(result.finishReason).toBe("tool_calls");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toEqual({
      id: "call_1",
      type: "function",
      function: { name: "file", arguments: '{"action": "read", "file": "test.txt"}' },
    });
  });
});
