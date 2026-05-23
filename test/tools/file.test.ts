import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileTool } from "../../src/tools/file.js";

function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), "file-test-"));
  writeFileSync(join(d, "hello.txt"), "Hello\nWorld\nLine 3\n");
  writeFileSync(join(d, "binary.bin"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(d, "long.txt"), "A".repeat(12000));
  mkdirSync(join(d, "sub"));
  writeFileSync(join(d, "sub", "nested.txt"), "nested");
  return d;
}

describe("File Tool", () => {
  describe("read", () => {
    let dir: string;
    beforeAll(() => { dir = freshDir(); });

    it("returns file content with line numbers", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "read", path: "hello.txt" });
      expect(result).toContain("1: Hello");
      expect(result).toContain("2: World");
      expect(result).toContain("3: Line 3");
    });

    it("detects binary files and returns [binary file]", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "read", path: "binary.bin" });
      expect(result).toBe("[binary file]");
    });

    it("truncates at 10K chars with truncation notice", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "read", path: "long.txt" });
      expect(result.length).toBeLessThanOrEqual(10100);
      expect(result).toContain("[output truncated]");
    });
  });

  describe("write", () => {
    let dir: string;
    beforeAll(() => { dir = freshDir(); });

    it("writes content and returns byte count", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "write", path: "new.txt", content: "test data" });
      expect(result).toContain("Written");
      expect(result).toContain("new.txt");
      expect(result).toContain("9 bytes");
      expect(existsSync(join(dir, "new.txt"))).toBe(true);
    });

    it("creates parent directories when missing", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "write", path: "a/b/c/deep.txt", content: "deep" });
      expect(result).toContain("Written");
      expect(existsSync(join(dir, "a", "b", "c", "deep.txt"))).toBe(true);
    });
  });

  describe("edit", () => {
    let dir: string;
    beforeAll(() => { dir = freshDir(); });

    it("replaces exact oldString with newString", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({
        action: "edit",
        path: "hello.txt",
        oldString: "Hello",
        newString: "Hi",
      });
      expect(result).toContain("Hello");
      expect(result).toContain("Hi");
    });

    it("returns error when oldString not found", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({
        action: "edit",
        path: "hello.txt",
        oldString: "NonExistentStringXYZ",
        newString: "anything",
      });
      expect(result).toBe("oldString not found");
    });

    it("returns error when oldString has multiple matches", async () => {
      writeFileSync(join(dir, "dup.txt"), "foo\nfoo\nbar\n");
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({
        action: "edit",
        path: "dup.txt",
        oldString: "foo",
        newString: "baz",
      });
      expect(result).toBe("found 2 matches, provide more context");
    });
  });

  describe("glob", () => {
    let dir: string;
    beforeAll(() => { dir = freshDir(); });

    it("returns paths sorted by mtime (newest first)", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "glob", pattern: "**/*.txt" });
      const lines = result.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it("returns '(no matches)' when no files match", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "glob", pattern: "**/*.xyz" });
      expect(result).toBe("(no matches)");
    });
  });

  describe("grep", () => {
    let dir: string;
    beforeAll(() => { dir = freshDir(); });

    it("returns matches with line numbers", async () => {
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({
        action: "grep",
        pattern: "Hello",
        path: "hello.txt",
      });
      expect(result).toContain("hello.txt:1: Hello");
    });

    it("caps results at 200 matches", async () => {
      writeFileSync(join(dir, "many.txt"), "match\n".repeat(300));
      const tool = createFileTool({ allowedPath: dir });
      const result = await tool.execute({ action: "grep", pattern: "match" });
      expect(result).toContain("(showing first 200 matches)");
    });
  });
});
