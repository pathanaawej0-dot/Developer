import { Box } from "ink";
import { useState, useLayoutEffect, type FC } from "react";
import { useEventBus } from "../event-bus/index.js";
import { Message } from "./message.js";
import { ToolCard, ToolCardToggleProvider } from "./tool-card.js";
import type { ToolStatus } from "./tool-card.js";

interface MessageListProps {
  toggleAllSignal?: number;
}

type DisplayItem =
  | { kind: "user"; content: string }
  | { kind: "assistant"; content: string; isStreaming: boolean }
  | { kind: "tool"; id: string; name: string; args: unknown; status: ToolStatus; output?: string };

let toolIdCounter = 0;

export const MessageList: FC<MessageListProps> = ({ toggleAllSignal = 0 }) => {
  const bus = useEventBus();
  const [items, setItems] = useState<DisplayItem[]>([]);

  useLayoutEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      bus.subscribe("agent:thinking", (payload) => {
        setItems((prev) => [...prev, { kind: "user", content: payload.message }]);
      }),
    );

    unsubs.push(
      bus.subscribe("agent:token", (payload) => {
        setItems((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === "assistant" && last.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + payload.token,
            };
            return updated;
          }
          return [...prev, { kind: "assistant", content: payload.token, isStreaming: true }];
        });
      }),
    );

    unsubs.push(
      bus.subscribe("agent:done", (payload) => {
        setItems((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === "assistant") {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, isStreaming: false, content: payload.result };
            return updated;
          }
          return [...prev, { kind: "assistant", content: payload.result, isStreaming: false }];
        });
      }),
    );

    unsubs.push(
      bus.subscribe("tool:start", (payload) => {
        const id = `tool-${++toolIdCounter}`;
        setItems((prev) => [...prev, { kind: "tool", id, name: payload.tool, args: payload.args, status: "running" }]);
      }),
    );

    unsubs.push(
      bus.subscribe("tool:end", (payload) => {
        const output = typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result);
        setItems((prev) => {
          const idx = [...prev].reverse().findIndex(
            (item) => item.kind === "tool" && item.name === payload.tool && item.status === "running",
          );
          if (idx === -1) return prev;
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          const tool = updated[realIdx];
          if (tool.kind === "tool") {
            updated[realIdx] = { ...tool, status: "done", output };
          }
          return updated;
        });
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, [bus]);

  return (
    <ToolCardToggleProvider value={toggleAllSignal}>
      <Box flexDirection="column">
        {items.map((item, i) => {
          switch (item.kind) {
            case "user":
              return <Message key={`u-${i}`} message={{ role: "user", content: item.content }} />;
            case "assistant":
              return (
                <Message
                  key={`a-${i}`}
                  message={{ role: "assistant", content: item.content }}
                />
              );
            case "tool":
              return (
                <ToolCard
                  key={item.id}
                  name={item.name}
                  status={item.status}
                  args={item.args}
                  output={item.output}
                />
              );
          }
        })}
      </Box>
    </ToolCardToggleProvider>
  );
};
