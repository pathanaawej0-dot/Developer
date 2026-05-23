import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { createEventBus, EventBusProvider, useEventBus } from "../../src/event-bus/index.js";
import type { FC } from "react";

describe("EventBus", () => {
  it("delivers events to all subscribers", () => {
    const bus = createEventBus();
    const results: string[] = [];

    bus.subscribe("agent:token", (payload) => {
      results.push(payload.token);
    });

    bus.emit("agent:token", { token: "hello" });

    expect(results).toEqual(["hello"]);
  });

  it("unsubscribing stops delivery", () => {
    const bus = createEventBus();
    const results: string[] = [];

    const unsub = bus.subscribe("agent:token", (payload) => {
      results.push(payload.token);
    });

    unsub();
    bus.emit("agent:token", { token: "hello" });

    expect(results).toEqual([]);
  });

  it("makes bus available via React context and hook", () => {
    const bus = createEventBus();
    const tokens: string[] = [];

    const Child: FC = () => {
      const b = useEventBus();
      b.subscribe("agent:token", (p) => tokens.push(p.token));
      return null;
    };

    render(
      <EventBusProvider bus={bus}>
        <Child />
      </EventBusProvider>,
    );

    bus.emit("agent:token", { token: "via-context" });
    expect(tokens).toEqual(["via-context"]);
  });
});
