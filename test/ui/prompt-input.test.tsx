import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import { PromptInput } from "../../src/ui/prompt-input.js";

describe("PromptInput", () => {
  it("renders placeholder when idle", () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <PromptInput onSubmit={onSubmit} placeholder="Ask me anything..." />,
    );

    const frame = lastFrame();
    expect(frame).toContain("Ask me anything...");
  });

  it("renders typed input visually", () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("hello");

    const frame = lastFrame();
    expect(frame).toContain("hello");
  });

  it("submits text on Enter", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("hello");
    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("does not submit empty input on Enter", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("\r");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit whitespace-only input on Enter", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("   ");
    stdin.write("\r");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores input when disabled", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <PromptInput onSubmit={onSubmit} disabled={true} />,
    );

    stdin.write("hello");
    stdin.write("\r");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows placeholder when idle and hides it after typing", () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <PromptInput onSubmit={onSubmit} placeholder="Type here..." />,
    );

    expect(lastFrame()).toContain("Type here...");

    stdin.write("hi");

    expect(lastFrame()).not.toContain("Type here...");
  });

  it("clears value after submit", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("hello");
    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+J inserts newline instead of submitting", () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("line1");
    stdin.write("\n");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("line1");
  });

  it("Ctrl+J then Enter submits text with newline", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("line1");
    stdin.write("\n");
    stdin.write("line2");
    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith("line1\nline2");
  });

  it("other ctrl keys like Ctrl+C do not submit or add to value", () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("hello");
    stdin.write("\x03");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("hello");
    expect(lastFrame()).not.toContain("\x03");
  });

  it("only Enter submits, not random keystrokes or ctrl keys", () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("\x01");
    stdin.write("\x02");
    stdin.write("\x05");
    stdin.write("\x0b");
    stdin.write("\x0c");
    stdin.write("\x0e");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders > prompt icon", () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    const frame = lastFrame();
    expect(frame).toContain(">");
  });

  it("renders separator lines above and below", () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    const frame = lastFrame();
    expect(frame).toContain("─");
  });

  it("shows typed content after > prompt", () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(<PromptInput onSubmit={onSubmit} />);

    stdin.write("hello world");

    const frame = lastFrame();
    expect(frame).toContain("> hello world");
  });

});
