Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Implement the remaining resilience and error handling features that make the agent robust in production use.

**10K char output cap**: All tool output (file read, bash stdout/stderr) is truncated at 10,000 characters. If truncation occurs, append `\n[output truncated]`. The agent can use `process log` with offset/limit to page through the rest.

**Binary file detection**: The file tool's `read` action scans the first 4KB for null bytes. If found, return `"[binary file]"` instead of raw content.

**Context trimming on overflow**: When the agent loop receives a context length exceeded error from the LLM provider, trim the oldest messages (preserving the system prompt and most recent turns) and retry once. If it fails again, emit an error and stop.

**Tool error handling (plain text)**: All tool errors — file not found, permission denied, invalid arguments, exit code 1, uncaught exceptions in handlers — are returned as plain-text strings in the conversation. No structured `isError` mechanism. The LLM reads the error text and decides how to recover.

**Missing API key**: On startup, if `KILO_API_KEY` is not set in the environment, render a clear error message telling the user to set it, then exit gracefully.

**Agent loop crash guard**: Wrap tool handler `execute()` in try/catch. If the handler throws an uncaught exception, return `"Error: {message}"` as a tool result rather than crashing the loop.

## Acceptance criteria

- [ ] File tool output truncated at 10K chars with truncation notice
- [ ] Bash tool output truncated at 10K chars with truncation notice
- [ ] Binary files return `[binary file]` instead of raw content
- [ ] Context overflow trims oldest messages and retries once
- [ ] Second consecutive overflow emits an error and stops
- [ ] File not found returns plain-text error (not a crash)
- [ ] Invalid tool arguments return plain-text error
- [ ] Uncaught exceptions in tool handlers return `"Error: {message}"`
- [ ] Missing `KILO_API_KEY` shows a clear startup error and exits
- [ ] `pnpm typecheck` passes

## Blocked by

- `04-tool-system-and-file-tool` (needs file tool to test caps)
- `05-bash-tool-and-process-tool` (needs bash tool to test caps)
