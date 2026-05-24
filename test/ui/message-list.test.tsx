import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { act } from "react";
import { MessageList } from "../../src/ui/message-list.js";
import { EventBusProvider, createEventBus } from "../../src/event-bus/index.js";

describe("MessageList", () => {
  it("renders a user message after agent:thinking event", () => {
    const bus = createEventBus();
    const { lastFrame } = render(
      <EventBusProvider bus={bus}>
        <MessageList />
      </EventBusProvider>,
    );

    act(() => {
      bus.emit("agent:thinking", { message: "hello from user" });
    });

    const frame = lastFrame();
    expect(frame).toContain("hello from user");
  });

  it("accepts toggleAllSignal prop without useInput", () => {
    const bus = createEventBus();
    const { lastFrame } = render(
      <EventBusProvider bus={bus}>
        <MessageList toggleAllSignal={1} />
      </EventBusProvider>,
    );

    act(() => {
      bus.emit("agent:thinking", { message: "hello" });
    });

    const frame = lastFrame();
    expect(frame).toContain("hello");
  });

  it("renders tool cards and assistant messages from events", () => {
    const bus = createEventBus();
    const { lastFrame } = render(
      <EventBusProvider bus={bus}>
        <MessageList />
      </EventBusProvider>,
    );

    act(() => {
      bus.emit("agent:thinking", { message: "list files" });
    });

    act(() => {
      bus.emit("tool:start", { tool: "bash", args: { command: "ls" } });
    });

    act(() => {
      bus.emit("tool:end", { tool: "bash", result: "file1.txt\nfile2.txt" });
    });

    act(() => {
      bus.emit("agent:token", { token: "Here are the files" });
    });

    act(() => {
      bus.emit("agent:done", { result: "Here are the files" });
    });

    const frame = lastFrame();
    expect(frame).toContain("list files");
    expect(frame).toContain("bash");
    expect(frame).toContain("Here are the files");
  });
});
