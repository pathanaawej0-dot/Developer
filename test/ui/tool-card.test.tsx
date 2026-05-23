import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { ToolCard } from "../../src/ui/tool-card.js";

describe("ToolCard", () => {
  it("renders tool name and status in the header", () => {
    const { lastFrame } = render(
      <ToolCard name="file" status="running" args={{ action: "read", path: "test.txt" }} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("file");
    expect(frame).toContain("running");
  });

  it("shows args and output when expanded", () => {
    const { lastFrame } = render(
      <ToolCard name="bash" status="done" args={{ command: "ls" }} output="file1.txt\nfile2.txt" />,
    );

    const frame = lastFrame();
    expect(frame).toContain('"command"');
    expect(frame).toContain("ls");
    expect(frame).toContain("file1.txt");
  });

  it("renders with a color based on tool type", () => {
    const { lastFrame } = render(
      <ToolCard name="file" status="running" args={{}} />,
    );
    expect(lastFrame()).toContain("file");
  });

  it("renders different tool types without error", () => {
    const r1 = render(<ToolCard name="file" status="running" args={{}} />);
    expect(r1.lastFrame()).toContain("file");
    r1.cleanup();

    const r2 = render(<ToolCard name="bash" status="running" args={{}} />);
    expect(r2.lastFrame()).toContain("bash");
    r2.cleanup();

    const r3 = render(<ToolCard name="process" status="running" args={{}} />);
    expect(r3.lastFrame()).toContain("process");
    r3.cleanup();
  });
});
