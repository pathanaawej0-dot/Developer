import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { StatusBar } from "../../src/ui/status-bar.js";

describe("StatusBar", () => {
  it("shows model name on the left", () => {
    const { lastFrame } = render(
      <StatusBar modelName="deepseek-v4-flash" status="idle" />,
    );

    expect(lastFrame()).toContain("deepseek-v4-flash");
  });

  it("shows idle status in center", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="idle" />,
    );

    expect(lastFrame()).toContain("idle");
  });

  it("shows thinking status", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="thinking" />,
    );

    expect(lastFrame()).toContain("thinking...");
  });

  it("shows running tool with tool name", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="running" toolName="bash" />,
    );

    expect(lastFrame()).toContain("running tool: bash");
  });

  it("shows streaming status", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="streaming" />,
    );

    expect(lastFrame()).toContain("streaming");
  });

  it("shows token count on the right", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="idle" tokenCount={1500} />,
    );

    expect(lastFrame()).toContain("1.5K tokens");
  });

  it("shows 0 tokens when count is undefined", () => {
    const { lastFrame } = render(
      <StatusBar modelName="test" status="idle" />,
    );

    expect(lastFrame()).toContain("0 tokens");
  });
});
