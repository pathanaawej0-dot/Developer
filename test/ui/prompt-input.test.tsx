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

  it("calls onToggleCards on Ctrl+O", () => {
    const onSubmit = vi.fn();
    const onToggleCards = vi.fn();
    const { stdin } = render(
      <PromptInput onSubmit={onSubmit} onToggleCards={onToggleCards} />,
    );

    stdin.write("\x0f");

    expect(onToggleCards).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not call onToggleCards for regular input", () => {
    const onSubmit = vi.fn();
    const onToggleCards = vi.fn();
    const { stdin } = render(
      <PromptInput onSubmit={onSubmit} onToggleCards={onToggleCards} />,
    );

    stdin.write("hello");

    expect(onToggleCards).not.toHaveBeenCalled();
  });
});
