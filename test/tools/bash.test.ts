import { describe, it, expect } from "vitest";
import { createBashTool } from "../../src/tools/bash.js";

describe("Bash Tool", () => {
  describe("foreground", () => {
    it("runs a command and returns output with exit code", async () => {
      const tool = createBashTool();
      const result = await tool.execute({
        action: "foreground",
        command: "echo hello world",
      });
      expect(result).toContain("hello world");
      expect(result).toContain("[exit code: 0]");
    });
  });

  describe("background", () => {
    it("returns sessionId immediately with explicit background flag", async () => {
      const tool = createBashTool();
      const result = await tool.execute({
        action: "background",
        command: "echo running in background",
      });
      expect(result).toMatch(/\[background: bg-\d+\]/);
    });
  });

  describe("timeout", () => {
    it("kills a long-running process after timeout", { timeout: 15000 }, async () => {
      const tool = createBashTool();
      const result = await tool.execute({
        action: "foreground",
        command: process.platform === "win32" ? "ping -n 10 127.0.0.1" : "sleep 30",
        timeout: 500,
      });
      expect(result).toContain("[exit code:");
    });
  });

  describe("output cap", () => {
    it("truncates output at 10K chars", async () => {
      const tool = createBashTool();
      const result = await tool.execute({
        action: "foreground",
        command: process.platform === "win32"
          ? "cmd /c for /l %i in (1,1,500) do @echo AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          : "for i in $(seq 1 500); do echo AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA; done",
      });
      expect(result.length).toBeLessThanOrEqual(10200);
      expect(result).toContain("[output truncated]");
    });
  });
});
