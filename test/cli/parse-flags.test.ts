import { describe, it, expect } from "vitest";
import { parseCliFlags } from "../../src/cli/parse-flags.js";

describe("parseCliFlags", () => {
  it("parses --session flag", () => {
    const flags = parseCliFlags(["--session", "abc-123"]);
    expect(flags.session).toBe("abc-123");
  });

  it("parses --model flag", () => {
    const flags = parseCliFlags(["--model", "deepseek/deepseek-v4-flash"]);
    expect(flags.model).toBe("deepseek/deepseek-v4-flash");
  });

  it("parses --session and --model together", () => {
    const flags = parseCliFlags(["--session", "abc-123", "--model", "deepseek/deepseek-v4-flash"]);
    expect(flags.session).toBe("abc-123");
    expect(flags.model).toBe("deepseek/deepseek-v4-flash");
  });

  it("returns undefined session when flag is missing", () => {
    const flags = parseCliFlags([]);
    expect(flags.session).toBeUndefined();
  });

  it("returns undefined model when flag is missing", () => {
    const flags = parseCliFlags([]);
    expect(flags.model).toBeUndefined();
  });

  it("handles --session without value gracefully", () => {
    const flags = parseCliFlags(["--session"]);
    expect(flags.session).toBeUndefined();
  });

  it("handles --model without value gracefully", () => {
    const flags = parseCliFlags(["--model"]);
    expect(flags.model).toBeUndefined();
  });

  it("ignores unknown flags", () => {
    const flags = parseCliFlags(["--unknown", "value"]);
    expect(flags.session).toBeUndefined();
    expect(flags.model).toBeUndefined();
  });
});
