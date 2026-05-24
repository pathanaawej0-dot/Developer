import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { act } from "react";
import App from "../../src/ui/app.js";
import { createEventBus } from "../../src/event-bus/index.js";

describe("App", () => {
  it("renders PromptInput and StatusBar", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    const frame = lastFrame();
    expect(frame).toContain("Ask me anything...");
    expect(frame).toContain("deepseek-v4-flash");
    expect(frame).toContain("idle");
  });

  it("updates status bar on agent events", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    act(() => {
      bus.emit("agent:thinking", { message: "hello" });
    });

    expect(lastFrame()).toContain("thinking...");

    act(() => {
      bus.emit("agent:token", { token: "Hello" });
    });

    expect(lastFrame()).toContain("streaming");

    act(() => {
      bus.emit("agent:done", { result: "Hello world" });
    });

    expect(lastFrame()).toContain("idle");
  });

  it("updates status bar on tool events", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    act(() => {
      bus.emit("agent:thinking", { message: "list files" });
    });

    act(() => {
      bus.emit("tool:start", { tool: "bash", args: { command: "ls" } });
    });

    expect(lastFrame()).toContain("running tool: bash");
  });

  it("disables input while agent is thinking", () => {
    const bus = createEventBus();
    const { stdin } = render(<App eventBus={bus} modelName="test" />);

    act(() => {
      bus.emit("agent:thinking", { message: "hi" });
    });

    // Attempt to type while thinking
    stdin.write("should not appear");
    stdin.write("\r");
  });

  it("does not crash on Ctrl+O toggle", () => {
    const bus = createEventBus();
    const { stdin, lastFrame } = render(<App eventBus={bus} />);

    expect(lastFrame()).toContain("Ask me anything...");

    stdin.write("\x0f");

    expect(lastFrame()).toContain("Ask me anything...");
  });

  it("tracks token count", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    act(() => {
      bus.emit("agent:thinking", { message: "hello" });
    });

    for (let i = 0; i < 5; i++) {
      act(() => {
        bus.emit("agent:token", { token: "a" });
      });
    }

    expect(lastFrame()).toContain("5 tokens");
  });
});
