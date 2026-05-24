import { Box, Text, useStdin, useStdout } from "ink";
import { useLayoutEffect, useRef, useState, type FC } from "react";

interface PromptInputProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function parseInput(data: string) {
  const key = { return: false, shift: false, backspace: false, delete: false, ctrl: false, meta: false };

  if (data === "\r") {
    key.return = true;
    return { input: "", key };
  }

  if (data === "\n") {
    return { input: "\n", key };
  }

  if (data === "\b" || data === "\x7f") {
    key.backspace = true;
    return { input: "", key };
  }

  if (data === "\t") {
    return { input: "", key };
  }

  if (data.startsWith("\x1b")) {
    key.meta = true;
    if (data.length === 1) {
      return { input: "", key: { ...key, meta: false } };
    }
    if (data === "\x1b[3~") {
      return { input: "", key: { ...key, meta: false, delete: true } };
    }
    return { input: "", key: { ...key, meta: false } };
  }

  if (data.length === 1 && data >= "\x01" && data <= "\x1a") {
    key.ctrl = true;
    return { input: "", key };
  }

  if (data.length === 1 && data >= "A" && data <= "Z") {
    key.shift = true;
    return { input: data.toLowerCase(), key };
  }

  if (data.length === 1 && data >= "a" && data <= "z") {
    return { input: data, key };
  }

  return { input: data, key };
}

export const PromptInput: FC<PromptInputProps> = ({ onSubmit, disabled = false, placeholder = "Ask me anything..." }) => {
  const [displayValue, setDisplayValue] = useState("");
  const valueRef = useRef("");
  const { setRawMode, internal_eventEmitter } = useStdin();
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 40;
  const separator = "─".repeat(columns);

  useLayoutEffect(() => {
    setRawMode(true);

    const handleData = (data: string) => {
      if (disabled) return;

      const { input, key } = parseInput(data);

      if (key.return) {
        const trimmed = valueRef.current.trim();
        if (trimmed) {
          onSubmit(trimmed);
          valueRef.current = "";
          setDisplayValue("");
        }
        return;
      }

      if (key.backspace || key.delete) {
        valueRef.current = valueRef.current.slice(0, -1);
        setDisplayValue(valueRef.current);
        return;
      }

      if (input.length > 0 && !key.ctrl && !key.meta) {
        valueRef.current += input;
        setDisplayValue(valueRef.current);
      }
    };

    internal_eventEmitter?.on("input", handleData);

    return () => {
      internal_eventEmitter?.removeListener("input", handleData);
      setRawMode(false);
    };
  }, [disabled, onSubmit, setRawMode, internal_eventEmitter]);

  return (
    <Box flexDirection="column">
      <Text dimColor>{separator}</Text>
      <Box>
        <Text color="cyan">{"> "}</Text>
        {displayValue ? (
          <Text>{displayValue}</Text>
        ) : (
          <Text dimColor>{placeholder}</Text>
        )}
      </Box>
      <Text dimColor>{separator}</Text>
    </Box>
  );
};
