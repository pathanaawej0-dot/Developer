import type { Provider } from "./provider.js";
import type { EventBus } from "../event-bus/index.js";
import type { Message } from "../session-store/index.js";
import { createSessionStore } from "../session-store/index.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

const SYSTEM_PROMPT: ChatCompletionMessageParam = {
  role: "system",
  content: "You are a helpful coding assistant with file access. Use the tools to read and write files. Once you have the information you need, provide your final answer. Do NOT call the same tool twice with the same arguments.",
};

export interface AgentConfig {
  provider: Provider;
  eventBus: EventBus;
  sessionStore: ReturnType<typeof createSessionStore>;
  sessionId: string;
  registry?: ToolRegistry;
  maxTurns?: number;
}

function isContextLengthError(err: Error): boolean {
  return err.message.toLowerCase().includes("context length")
    || err.message.toLowerCase().includes("maximum context")
    || err.message.toLowerCase().includes("too many tokens");
}

function messagesToParams(messages: Message[]): ChatCompletionMessageParam[] {
  return [SYSTEM_PROMPT, ...messages.map((m) => {
    return {
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    } as ChatCompletionMessageParam;
  })];
}

export function createAgent(config: AgentConfig) {
  const { provider, eventBus, sessionStore, sessionId } = config;
  const registry = config.registry;
  const maxTurns = config.maxTurns ?? Infinity;
  let turnCount = 0;

  let retried = false;

  async function executeTurn(): Promise<void> {
    while (turnCount < maxTurns) {
      turnCount++;

      try {
        const session = await sessionStore.loadSession(sessionId);
        const params = messagesToParams(session.messages);

        const tools = registry?.getToolDefinitions();

        const result = await provider.stream(params, {
          onToken(token: string) {
            eventBus.emit("agent:token", { token });
          },
          onError(error: Error) {
            eventBus.emit("error", { error });
          },
        }, tools);

        if (result.finishReason === "stop") {
          const assistantMessage: Message = {
            role: "assistant",
            content: result.content,
          };
          await sessionStore.appendMessages(sessionId, [assistantMessage]);
          eventBus.emit("agent:done", { result: result.content });
          return;
        }

        if (result.finishReason === "tool_calls" && result.toolCalls?.length) {
          const assistantMessage: Message = {
            role: "assistant",
            content: result.content,
            tool_calls: result.toolCalls,
          };
          await sessionStore.appendMessages(sessionId, [assistantMessage]);

          for (const tc of result.toolCalls) {
            eventBus.emit("tool:start", {
              tool: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            });
          }

          const dispatchResults = await Promise.all(
            result.toolCalls.map(async (tc) => {
              if (!registry) {
                return { tc, output: `No registry available for tool: ${tc.function.name}` };
              }
              const args = JSON.parse(tc.function.arguments);
              const output = await registry.dispatch(tc.function.name, args);
              return { tc, output };
            }),
          );

          const toolMessages: Message[] = dispatchResults.map(({ tc, output }) => ({
            role: "tool",
            content: output,
            tool_call_id: tc.id,
            name: tc.function.name,
          }));
          await sessionStore.appendMessages(sessionId, toolMessages);

          for (const { tc, output } of dispatchResults) {
            eventBus.emit("tool:end", { tool: tc.function.name, result: output });
          }

          continue;
        }

        eventBus.emit("agent:done", { result: result.content });
        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (isContextLengthError(err) && !retried) {
          retried = true;
          const session = await sessionStore.loadSession(sessionId);
          if (session.messages.length > 2) {
            const trimmed = [session.messages[0], ...session.messages.slice(-2)];
            await sessionStore.replaceMessages(sessionId, trimmed);
          }
          continue;
        }
        eventBus.emit("error", { error: err });
        eventBus.emit("agent:done", { result: `Error: ${err.message}` });
        return;
      }
    }
  }

  return {
    async run(prompt: string): Promise<void> {
      const userMessage: Message = { role: "user", content: prompt };
      await sessionStore.appendMessages(sessionId, [userMessage]);
      eventBus.emit("agent:thinking", { message: prompt });
      await executeTurn();
    },
  };
}
