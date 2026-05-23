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
  it("throws a clear error when API key is missing", () => {
    expect(() => createProvider({ apiKey: "" })).toThrow("KILO_API_KEY");
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

  it("accumulates tool_calls deltas from stream", async () => {
    const provider = createProvider({ apiKey: "test-key" });

    mockCreate.mockResolvedValue(makeStream([
      {
        type: "response.function_call_arguments.delta",
        delta: '{"file":',
        item_id: "call_1",
        output_index: 0,
      },
      {
        type: "response.function_call_arguments.delta",
        delta: ' "/test.txt"}',
        item_id: "call_1",
        output_index: 0,
      },
      { type: "response.completed", response: { status: "completed" } },
    ]));

    const result = await provider.stream(
      [{ role: "user", content: "read file" }],
    );

    expect(result.finishReason).toBe("stop");
  });
});
