import { Box, Text } from "ink";
import { useState, createContext, useContext, useEffect, type FC, type ReactNode } from "react";

export type ToolType = "file" | "bash" | "process";
export type ToolStatus = "running" | "done" | "error";

const TOOL_COLORS: Record<string, string> = {
  file: "blue",
  bash: "green",
  process: "yellow",
};

export interface ToolCardProps {
  name: string;
  status: ToolStatus;
  args: unknown;
  output?: string;
}

const ToolCardToggleContext = createContext(0);

export const ToolCardToggleProvider: FC<{ value: number; children: ReactNode }> = ({ value, children }) => {
  return (
    <ToolCardToggleContext.Provider value={value}>
      {children}
    </ToolCardToggleContext.Provider>
  );
};

export const ToolCard: FC<ToolCardProps> = ({ name, status, args, output }) => {
  const [expanded, setExpanded] = useState(true);
  const toggleSignal = useContext(ToolCardToggleContext);

  useEffect(() => {
    if (toggleSignal > 0) {
      setExpanded((v) => !v);
    }
  }, [toggleSignal]);

  const color = TOOL_COLORS[name] ?? "white";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color={color} bold>
          {`${name} `}
        </Text>
        <Text dimColor>{`(${status})`}</Text>
      </Box>
      {!expanded && (
        <Box paddingLeft={2}>
          <Text dimColor>{`Args: ${JSON.stringify(args)}`}</Text>
        </Box>
      )}
      {expanded && (
        <Box paddingLeft={2} flexDirection="column">
          <Text>{`Args: ${JSON.stringify(args)}`}</Text>
          {output !== undefined && <Text>{output}</Text>}
        </Box>
      )}
    </Box>
  );
};
