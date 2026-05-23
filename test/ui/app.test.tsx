import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import App from "../../src/ui/app.js";
import { createEventBus } from "../../src/event-bus/index.js";

describe("App", () => {
  it("renders without crashing", () => {
    const bus = createEventBus();
    const { lastFrame } = render(<App eventBus={bus} />);
    expect(lastFrame()).toBeDefined();
  });
});
