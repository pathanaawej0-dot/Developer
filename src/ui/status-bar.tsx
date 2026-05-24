import { Box, Text } from "ink";
import type { FC } from "react";

export type AgentStatus = "idle" | "thinking" | "streaming" | "running" | "done" | "error";

interface StatusBarProps {
  modelName: string;
  status: AgentStatus;
  toolName?: string;
  tokenCount?: number;
}

const statusLabel: Record<AgentStatus, string> = {
  idle: "idle",
  thinking: "thinking...",
  streaming: "streaming",
  running: "running",
  done: "done",
  error: "error",
};

function formatTokenCount(count?: number): string {
  if (count === undefined) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export const StatusBar: FC<StatusBarProps> = ({
  modelName,
  status,
  toolName,
  tokenCount,
}) => {
  let centerText = statusLabel[status];
  if (status === "running" && toolName) {
    centerText = `running tool: ${toolName}`;
  }

  return (
    <Box>
      <Box width="33%">
        <Text dimColor>{modelName}</Text>
      </Box>
      <Box width="34%" justifyContent="center">
        <Text>{centerText}</Text>
      </Box>
      <Box width="33%" justifyContent="flex-end">
        <Text dimColor>{formatTokenCount(tokenCount)} tokens</Text>
      </Box>
    </Box>
  );
};
