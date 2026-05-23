import { describe, it, expect, beforeAll } from "vitest";
import { createBashTool } from "../../src/tools/bash.js";
import { createProcessTool } from "../../src/tools/process.js";

describe("Process Tool", () => {
  describe("list", () => {
    it("returns empty list when no sessions exist", async () => {
      const tool = createProcessTool();
      const result = await tool.execute({ action: "list" });
      expect(result).toContain("[]");
    });
  });

  describe("invalid sessionId", () => {
    it("returns error for non-existent session on poll", async () => {
      const tool = createProcessTool();
      const result = await tool.execute({ action: "poll", sessionId: "nonexistent" });
      expect(result).toContain("not found");
    });

    it("returns error for non-existent session on kill", async () => {
      const tool = createProcessTool();
      const result = await tool.execute({ action: "kill", sessionId: "nonexistent" });
      expect(result).toContain("not found");
    });
  });
});
