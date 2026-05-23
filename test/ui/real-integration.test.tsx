import { describe, it, expect, beforeAll } from "vitest";
import { render } from "ink-testing-library";
import { act } from "react";
import { createEventBus } from "../../src/event-bus/index.js";
import { EventBusProvider } from "../../src/event-bus/index.js";
import { MessageList } from "../../src/ui/message-list.js";

describe("UI Real Integration", () => {
  let logs: string[];

  beforeAll(() => {
    logs = [];
    const logEvent = (label: string, data: unknown) => {
      const line = `[${label}] ${typeof data === "string" ? data : JSON.stringify(data)}`;
      logs.push(line);
      console.log(line);
    };

    const bus = createEventBus();

    bus.subscribe("agent:thinking", (p) => logEvent("THINKING", p.message));
    bus.subscribe("agent:token", (p) => logEvent("TOKEN", p.token));
    bus.subscribe("agent:done", (p) => logEvent("DONE", p.result));
    bus.subscribe("tool:start", (p) => logEvent("TOOL:START", `${p.tool}(${JSON.stringify(p.args)})`));
    bus.subscribe("tool:end", (p) => logEvent("TOOL:END", `${p.tool} => ${(p.result as string).slice(0, 200)}`));
    bus.subscribe("error", (p) => logEvent("ERROR", p.error.message));

    const { lastFrame } = render(
      <EventBusProvider bus={bus}>
        <MessageList />
      </EventBusProvider>,
    );

    console.log("\n=== EMITTING EVENTS ===\n");

    act(() => { bus.emit("agent:thinking", { message: "Create a file called hello.txt with content 'Hello from bash!'" }); });
    act(() => { bus.emit("tool:start", { tool: "file", args: { action: "write", path: "hello.txt", content: "Hello from bash!" } }); });
    act(() => { bus.emit("tool:end", { tool: "file", result: "Wrote 18 bytes to hello.txt" }); });
    act(() => { bus.emit("tool:start", { tool: "bash", args: { command: "ls" } }); });
    act(() => { bus.emit("tool:end", { tool: "bash", result: "hello.txt\nREADME.md" }); });
    act(() => { bus.emit("agent:token", { token: "Here" }); });
    act(() => { bus.emit("agent:token", { token: " is the result" }); });
    act(() => { bus.emit("agent:done", { result: "Here is the result" }); });

    const frame = lastFrame();
    console.log("\n=== RENDERED OUTPUT ===");
    console.log(frame);
    console.log("=== END OUTPUT ===\n");
  }, 30_000);

  it("produced logs from all events", () => {
    expect(logs.length).toBeGreaterThan(0);
    const allLogs = logs.join("\n");
    expect(allLogs).toContain("THINKING");
    expect(allLogs).toContain("TOKEN");
    expect(allLogs).toContain("DONE");
    expect(allLogs).toContain("TOOL:START");
    expect(allLogs).toContain("TOOL:END");
  });
});
