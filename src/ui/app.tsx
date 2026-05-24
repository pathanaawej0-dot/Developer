import { Box } from "ink";
import { useState, useLayoutEffect, type FC } from "react";
import { EventBusProvider } from "../event-bus/index.js";
import type { EventBus } from "../event-bus/index.js";
import { MessageList } from "./message-list.js";
import { PromptInput } from "./prompt-input.js";
import { StatusBar, type AgentStatus } from "./status-bar.js";

interface AppProps {
  eventBus: EventBus;
  modelName?: string;
}

function isBusy(status: AgentStatus): boolean {
  return status === "thinking" || status === "streaming" || status === "running";
}

const App: FC<AppProps> = ({ eventBus, modelName = "deepseek-v4-flash" }) => {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [toolName, setToolName] = useState<string | undefined>();
  const [tokenCount, setTokenCount] = useState(0);

  useLayoutEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      eventBus.subscribe("agent:thinking", () => {
        setStatus("thinking");
        setTokenCount(0);
        setToolName(undefined);
      }),
    );

    unsubs.push(
      eventBus.subscribe("agent:token", () => {
        setStatus("streaming");
        setTokenCount((prev) => prev + 1);
      }),
    );

    unsubs.push(
      eventBus.subscribe("tool:start", (payload) => {
        setStatus("running");
        setToolName(payload.tool);
      }),
    );

    unsubs.push(
      eventBus.subscribe("agent:done", () => {
        setStatus("idle");
        setToolName(undefined);
      }),
    );

    unsubs.push(
      eventBus.subscribe("error", () => {
        setStatus("error");
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, [eventBus]);

  const handleSubmit = (value: string) => {
    eventBus.emit("agent:thinking", { message: value });
  };

  return (
    <EventBusProvider bus={eventBus}>
      <Box flexDirection="column" height="100%">
        <Box flexGrow={1}>
          <MessageList />
        </Box>
        <PromptInput
          onSubmit={handleSubmit}
          disabled={isBusy(status)}
        />
        <StatusBar
          modelName={modelName}
          status={status}
          toolName={toolName}
          tokenCount={tokenCount}
        />
      </Box>
    </EventBusProvider>
  );
};

export default App;
