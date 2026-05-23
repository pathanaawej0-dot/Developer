import { describe, it, expect } from "vitest";
import { createToolRegistry } from "../../src/tools/registry.js";

describe("Tool Registry", () => {
  it("returns valid JSON Schema tool definitions for registered handlers", () => {
    const registry = createToolRegistry();

    registry.register({
      name: "file",
      description: "Read, write, edit, glob, or grep files",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["read", "write"] },
          path: { type: "string" },
        },
        required: ["action", "path"],
      },
      async execute() {
        return "ok";
      },
    });

    const defs = registry.getToolDefinitions();
    expect(defs).toHaveLength(1);

    const def = defs[0];
    expect(def).toMatchObject({
      type: "function",
      name: "file",
      description: "Read, write, edit, glob, or grep files",
    });
    expect(def.parameters).toBeDefined();
    expect(def.parameters.type).toBe("object");
  });

  it("dispatch calls the registered handler and returns its result", async () => {
    const registry = createToolRegistry();

    registry.register({
      name: "greeter",
      description: "Says hello",
      parameters: { type: "object", properties: {} },
      async execute(args) {
        return `Hello, ${args.name ?? "world"}!`;
      },
    });

    const result = await registry.dispatch("greeter", { name: "TDD" });
    expect(result).toBe("Hello, TDD!");
  });

  it("dispatch returns error string for unknown tools", async () => {
    const registry = createToolRegistry();

    const result = await registry.dispatch("nonexistent", {});
    expect(result).toBe("Unknown tool: nonexistent");
  });
});
