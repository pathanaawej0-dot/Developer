import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import App from "../../src/ui/app.js";

describe("App", () => {
  it('renders "Developer"', () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("Developer");
  });
});
