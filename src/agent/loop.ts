import type { Provider } from "./provider.js";
import type { EventBus } from "../event-bus/index.js";
import type { Message } from "../session-store/index.js";
import { createSessionStore } from "../session-store/index.js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

const SYSTEM_PROMPT: ChatCompletionMessageParam = {
  role: "system",
  content: "You are a helpful coding assistant.",
};

export interface AgentConfig {
  provider: Provider;
  eventBus: EventBus;
  sessionStore: ReturnType<typeof createSessionStore>;
  sessionId: string;
  maxTurns?: number;
}

function messagesToParams(messages: Message[]): ChatCompletionMessageParam[] {
  return [SYSTEM_PROMPT, ...messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    ...(m.name ? { name: m.name } : {}),
  } as ChatCompletionMessageParam))];
}

export function createAgent(config: AgentConfig) {
  const { provider, eventBus, sessionStore, sessionId } = config;
  const maxTurns = config.maxTurns ?? Infinity;
  let turnCount = 0;

  return {
    async run(prompt: string): Promise<void> {
      turnCount++;
      if (turnCount > maxTurns) return;

      const userMessage: Message = { role: "user", content: prompt };
      await sessionStore.appendMessages(sessionId, [userMessage]);

      eventBus.emit("agent:thinking", { message: prompt });

      const messages = await sessionStore.loadSession(sessionId);
      const params = messagesToParams(messages.messages);

      const result = await provider.stream(params, {
        onToken(token: string) {
          eventBus.emit("agent:token", { token });
        },
        onDone() {
          // handled below
        },
        onError(error: Error) {
          eventBus.emit("error", { error });
        },
      });

      if (result.finishReason === "stop") {
        const assistantMessage: Message = {
          role: "assistant",
          content: result.content,
        };
        await sessionStore.appendMessages(sessionId, [assistantMessage]);
        eventBus.emit("agent:done", { result: result.content });
      } else if (result.finishReason === "tool_calls") {
        eventBus.emit("agent:done", { result: result.content });
      }
    },
  };
}
