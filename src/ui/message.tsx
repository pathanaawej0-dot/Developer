import { Box, Text } from "ink";
import type { FC } from "react";
import type { Message as MessageType } from "../session-store/index.js";
import { ToolCard } from "./tool-card.js";
import type { ToolStatus } from "./tool-card.js";

export interface MessageProps {
  message: MessageType;
}

export const Message: FC<MessageProps> = ({ message }) => {
  if (message.role === "user") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text color="cyan" bold>{"user"}</Text>
        </Box>
        <Box paddingLeft={2}>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="green" bold>{"assistant"}</Text>
      </Box>
      {message.content ? (
        <Box paddingLeft={2}>
          <Text>{message.content}</Text>
        </Box>
      ) : null}
      {message.tool_calls?.map((tc) => (
        <ToolCard
          key={tc.id}
          name={tc.function.name}
          status={"done" as ToolStatus}
          args={JSON.parse(tc.function.arguments)}
        />
      ))}
    </Box>
  );
};
