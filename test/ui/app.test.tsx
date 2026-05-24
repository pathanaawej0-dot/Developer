import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import App from "../../src/ui/app.js";
import { createEventBus } from "../../src/event-bus/index.js";

describe("App", () => {
  it("renders PromptInput and StatusBar", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    const frame = lastFrame();
    expect(frame).toContain("Ask me anything...");
    expect(frame).toContain("idle");
  });

  it("calls onSubmit callback when user submits a prompt", () => {
    const bus = createEventBus();
    const onSubmit = vi.fn();
    const { stdin } = render(<App eventBus={bus} onSubmit={onSubmit} />);

    stdin.write("hello");
    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("shows model name passed as prop in status bar", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} modelName="custom-model" />);

    expect(lastFrame()).toContain("custom-model");
  });

  it("defaults model name", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);

    const frame = lastFrame();
    expect(frame).toContain("optimized");
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

  it("does not crash on Ctrl+O (no-op)", () => {
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

  it("does not crash when no onSubmit provided", () => {
    const bus = createEventBus();
    const { stdin, lastFrame } = render(<App eventBus={bus} />);

    stdin.write("hello");
    stdin.write("\r");

    const frame = lastFrame();
    expect(frame).toContain("idle");
  });
});
