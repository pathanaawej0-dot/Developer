import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
}

export interface ToolCallDelta {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface StreamResult {
  content: string;
  finishReason: "stop" | "tool_calls" | "length";
  toolCalls?: ToolCallDelta[];
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (result: StreamResult) => void;
  onError?: (error: Error) => void;
}

export interface Provider {
  stream(
    messages: ChatCompletionMessageParam[],
    callbacks?: StreamCallbacks,
    tools?: unknown[],
  ): Promise<StreamResult>;
}

function messagesToInput(messages: ChatCompletionMessageParam[]) {
  const systemMessages = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const instructions = systemMessages.map((m) => m.content).join("\n");
  const input = rest.map((m) => {
    if (m.role === "tool") {
      return {
        type: "function_call_output" as const,
        call_id: m.tool_call_id ?? "",
        output: m.content,
      };
    }
    return {
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    };
  });
  return {
    input,
    ...(instructions ? { instructions } : {}),
  };
}

export function createProvider(config?: ProviderConfig): Provider {
  const apiKey = config?.apiKey || process.env.KILO_API_KEY || "";

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.kilo.ai/api/gateway",
  });

  async function stream(
    messages: ChatCompletionMessageParam[],
    callbacks?: StreamCallbacks,
    tools?: unknown[],
  ): Promise<StreamResult> {
    let content = "";
    let finishReason: "stop" | "tool_calls" | "length" | null = null;
    const toolCallsMap = new Map<number, ToolCallDelta>();

    try {
      const { input, instructions } = messagesToInput(messages);

      const response = await client.responses.create({
        model: config?.model ?? "x-ai/grok-code-fast-1:optimized:free",
        input: input as never[],
        ...(instructions ? { instructions } : {}),
        ...(tools && tools.length > 0 ? { tools: tools as never[] } : {}),
        stream: true,
      });

      for await (const event of response) {
        switch (event.type) {
          case "response.output_text.delta": {
            const delta = (event as { delta: string }).delta;
            if (delta) {
              content += delta;
              callbacks?.onToken?.(delta);
            }
            break;
          }
          case "response.output_item.added": {
            const oe = event as { output_index: number; item: { type: string; name?: string; id: string } };
            if (oe.item?.type === "function_call") {
              toolCallsMap.set(oe.output_index, {
                id: oe.item.id,
                type: "function",
                function: { name: oe.item.name ?? "", arguments: "" },
              });
            }
            break;
          }
          case "response.function_call_arguments.delta": {
            const fe = event as { delta: string; output_index: number };
            const entry = toolCallsMap.get(fe.output_index);
            if (entry) {
              entry.function.arguments += fe.delta;
            }
            break;
          }
          case "response.completed": {
            const ce = event as { response: { status?: string; output?: { type: string }[] } };
            finishReason = "stop";
            if (ce.response?.status === "completed" && toolCallsMap.size > 0) {
              finishReason = "tool_calls";
            }
            break;
          }
          case "response.incomplete": {
            finishReason = "length";
            break;
          }
        }
      }

      const result: StreamResult = {
        content,
        finishReason: finishReason ?? "stop",
      };

      if (toolCallsMap.size > 0) {
        result.toolCalls = Array.from(toolCallsMap.values());
      }

      callbacks?.onDone?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw error;
    }
  }

  return { stream };
}
