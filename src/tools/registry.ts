export type ToolParameters = Record<string, unknown>;

export interface ToolHandler {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute(args: Record<string, unknown>): Promise<string>;
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface ToolRegistry {
  register(handler: ToolHandler): void;
  getToolDefinitions(): ToolDefinition[];
  dispatch(name: string, args: Record<string, unknown>): Promise<string>;
}

export function createToolRegistry(): ToolRegistry {
  const handlers = new Map<string, ToolHandler>();

  return {
    register(handler) {
      handlers.set(handler.name, handler);
    },

    getToolDefinitions() {
      return Array.from(handlers.values()).map((h) => ({
        type: "function" as const,
        name: h.name,
        description: h.description,
        parameters: h.parameters,
      }));
    },

    async dispatch(name, args) {
      const handler = handlers.get(name);
      if (!handler) {
        return `Unknown tool: ${name}`;
      }
      try {
        return await handler.execute(args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error: ${msg}`;
      }
    },
  };
}
