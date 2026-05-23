import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { Message } from "../../src/ui/message.js";
import type { Message as MessageType } from "../../src/session-store/index.js";

describe("Message", () => {
  it("renders a user message with role label and content", () => {
    const msg: MessageType = { role: "user", content: "hello world" };
    const { lastFrame } = render(<Message message={msg} />);
    const frame = lastFrame();
    expect(frame).toContain("user");
    expect(frame).toContain("hello world");
  });

  it("renders an assistant message with tool calls as embedded ToolCards", () => {
    const msg: MessageType = {
      role: "assistant",
      content: "Let me check that for you",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "file", arguments: JSON.stringify({ action: "read", path: "test.txt" }) },
        },
      ],
    };
    const { lastFrame } = render(<Message message={msg} />);
    const frame = lastFrame();
    expect(frame).toContain("assistant");
    expect(frame).toContain("Let me check that for you");
    expect(frame).toContain("file");
  });
});
