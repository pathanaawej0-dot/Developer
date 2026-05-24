import {
  readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync, statSync,
} from "node:fs";
import { resolve, isAbsolute, dirname } from "node:path";
import { glob } from "glob";
import type { ToolHandler } from "./registry.js";

interface FileToolConfig {
  allowedPath?: string;
}

export function createFileTool(config?: FileToolConfig): ToolHandler {
  const basePath = config?.allowedPath ?? process.cwd();

  function resolvePath(input: string): string {
    if (isAbsolute(input)) return input;
    return resolve(basePath, input);
  }

  async function handleRead(args: Record<string, unknown>): Promise<string> {
    const filePath = resolvePath(String(args.path ?? ""));
    if (statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
      return `${filePath} is a directory`;
    }
    const fd = openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytesRead = readSync(fd, buf, 0, 4096, 0);
    closeSync(fd);
    if (buf.subarray(0, bytesRead).includes(0)) {
      return "[binary file]";
    }
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
    if (numbered.length > 10000) {
      return numbered.slice(0, 10000) + "\n[output truncated]";
    }
    return numbered;
  }

  async function handleWrite(args: Record<string, unknown>): Promise<string> {
    const filePath = resolvePath(String(args.path ?? ""));
    const content = String(args.content ?? "");
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    return `Written ${args.path} (${Buffer.byteLength(content, "utf-8")} bytes)`;
  }

  async function handleEdit(args: Record<string, unknown>): Promise<string> {
    const filePath = resolvePath(String(args.path ?? ""));
    const oldString = String(args.oldString ?? "");
    const newString = String(args.newString ?? "");
    const content = readFileSync(filePath, "utf-8");
    const occurrences = content.split(oldString).length - 1;
    if (occurrences === 0) {
      return "oldString not found";
    }
    if (occurrences > 1) {
      return `found ${occurrences} matches, provide more context`;
    }
    const updated = content.replace(oldString, newString);
    writeFileSync(filePath, updated, "utf-8");
    const before = content.split(oldString)[0];
    const lineNumber = before.split("\n").length;
    const displayOld = oldString.length > 40 ? oldString.slice(0, 40) + "..." : oldString;
    const displayNew = newString.length > 40 ? newString.slice(0, 40) + "..." : newString;
    return `Replaced '${displayOld}' with '${displayNew}' at line ${lineNumber}`;
  }

  async function handleGlob(args: Record<string, unknown>): Promise<string> {
    const pattern = String(args.pattern ?? "");
    const matches = await glob(pattern, { cwd: basePath });
    if (matches.length === 0) {
      return "(no matches)";
    }
    matches.sort((a, b) => {
      const mtimeA = statSync(resolve(basePath, a)).mtimeMs;
      const mtimeB = statSync(resolve(basePath, b)).mtimeMs;
      return mtimeB - mtimeA;
    });
    return matches.join("\n");
  }

  async function handleGrep(args: Record<string, unknown>): Promise<string> {
    const pattern = String(args.pattern ?? "");
    const specificFile = args.path ? String(args.path) : "";
    const includeFilter = args.include ? String(args.include) : "**/*";
    const regex = new RegExp(pattern);
    let files: string[];
    if (specificFile) {
      files = [specificFile];
    } else {
      files = await glob(includeFilter, { cwd: basePath });
    }
    const matches: string[] = [];
    for (const file of files) {
      if (matches.length >= 200) break;
      const fullPath = resolve(basePath, file);
      try {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= 200) break;
          if (regex.test(lines[i])) {
            matches.push(`${file}:${i + 1}: ${lines[i]}`);
          }
        }
      } catch (e) {
        // skip unreadable files
      }
    }
    let result = matches.join("\n");
    if (matches.length >= 200) {
      result += "\n(showing first 200 matches)";
    }
    return result || "(no matches)";
  }

  return {
    name: "file",
    description:
      "Read, write, edit, glob, and grep files. Use action 'read' to view file contents, 'write' to create or overwrite files, 'edit' to replace text in a file, 'glob' to list files matching a pattern, and 'grep' to search file contents.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["read", "write", "edit", "glob", "grep"],
          description: "The file operation to perform",
        },
        path: {
          type: "string",
          description:
            "File path (required for read, write, edit; optional for grep)",
        },
        content: {
          type: "string",
          description: "Content to write (required for write action)",
        },
        oldString: {
          type: "string",
          description: "Text to replace (required for edit action)",
        },
        newString: {
          type: "string",
          description: "Replacement text (required for edit action)",
        },
        pattern: {
          type: "string",
          description:
            "Glob pattern for glob action, or search pattern for grep action",
        },
        include: {
          type: "string",
          description:
            "File glob filter (for grep action, defaults to **/*)",
        },
      },
      required: ["action"],
    },
    async execute(args) {
      const action = String(args.action ?? "");
      switch (action) {
        case "read":
          return handleRead(args);
        case "write":
          return handleWrite(args);
        case "edit":
          return handleEdit(args);
        case "glob":
          return handleGlob(args);
        case "grep":
          return handleGrep(args);
        default:
          return `Unknown action: ${action}`;
      }
    },
  };
}
