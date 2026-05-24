Status: ready-for-agent

## Problem Statement

Building a CLI coding agent from scratch requires cohesive orchestration across three concerns: an LLM-powered agent loop, a set of filesystem/process interaction tools, and a terminal UI. There is currently no working implementation — only design docs exist. A developer needs a fully functional agent to experiment with tool-calling LLMs (DeepSeek v4 Flash via Kilo Gateway) in a Claude Code-like interface.

## Solution

A single Node.js process running an Ink-based terminal UI that hosts an agent loop. The agent receives multi-line prompts, sends them (with conversation history + tool definitions) to DeepSeek v4 Flash via the Kilo Gateway, executes tool calls when the LLM requests them, and streams text responses token-by-token. Three tools cover the surface area: a unified `file` tool (read, write, edit, glob, grep), a `bash` tool (foreground execution with auto-background for long-running commands), and a `process` tool (manage background bash sessions). Sessions auto-save to `~/.developer/sessions/` as JSON.

## User Stories

1. As a developer, I want to type a multi-line prompt and submit it with Enter, so that I can ask the agent questions or give it tasks.

2. As a developer, I want to shift+Enter to insert a newline in my prompt, so that I can write multi-line instructions.

3. As a developer, I want the assistant's response to stream token-by-token, so that I see progress immediately.

4. As a developer, I want the agent to call tools when the LLM decides to, so that it can read files, run commands, and edit code autonomously.

5. As a developer, I want the agent to make unlimited turns by default, so that long multi-step tasks complete without interruption.

6. As a developer, I want the file tool to read files with line numbers, so that I can reference specific lines in my prompts.

8. As a developer, I want the file tool to write files (creating parent directories if needed), so that the agent can scaffold or modify code.

9. As a developer, I want the file tool to edit files by exact string replacement, so that targeted changes don't require rewriting the whole file.

10. As a developer, I want the file tool to glob for file paths and grep within files, so that the agent can navigate the codebase.

11. As a developer, I want the bash tool to run shell commands in the foreground and return output directly, so that quick commands complete in one turn.

12. As a developer, I want long-running bash commands to auto-background after a yield threshold, so that the agent isn't blocked waiting.

13. As a developer, I want the process tool to list, poll, log, write to stdin, and kill background sessions, so that I can interact with long-lived processes.

14. As a developer, I want the process tool's log action to support offset/limit paging, so that I can read output that exceeds the 10K char cap.

15. As a developer, I want sessions to auto-save after every turn, so that I never lose conversation history.

16. As a developer, I want to resume a previous session with `--session`, so that interrupted work can continue.

17. As a developer, I want to list saved sessions, so that I can find and resume them.

18. As a developer, I want tool calls to display as collapsible cards with name, arguments, and output, so that I can inspect what the agent did.

19. As a developer, I want tool cards to be color-coded by tool type, so that I can visually distinguish file, bash, and process operations.

20. As a developer, I want to toggle all tool cards expanded/collapsed with a keyboard shortcut, so that I can control the level of detail.

21. As a developer, I want the status bar to show the model name, agent state, and token count, so that I have context at a glance.

22. As a developer, I want the prompt input to be disabled while the agent is thinking, so that I don't accidentally submit concurrent prompts.

23. As a developer, I want binary files to be safely detected and reported as `[binary file]`, so that the agent doesn't corrupt its context with garbage.

24. As a developer, I want tool output capped at 10K characters with a truncation notice, so that the LLM context window isn't overwhelmed.

25. As a developer, I want all tool errors returned as plain text in the conversation, so that the LLM can decide how to recover.

26. As a developer, I want the agent to trim oldest messages on context overflow and retry, so that long sessions remain functional.

27. As a developer, I want the agent to run multiple independent tool calls in parallel, so that multi-file reads complete quickly.

28. As a developer, I want the Windows shell (cmd.exe) used when on Windows, so that the tool works on the primary development platform.

29. As a developer, I want the Kilo Gateway API key read from `KILO_API_KEY` env var with a clear error if missing, so that setup is straightforward.

30. As a developer, I want to start the app with `pnpm dev` (tsx watch) for development and `pnpm start` for production, so that the workflow matches standard Node projects.

## Implementation Decisions

### Module Breakdown

The implementation is split into 11 modules:

1. **CLI Entry** (`src/index.tsx`) — Parse CLI flags (`--model`, `--session`), initialize session store, create agent and tools, render `<App>` via Ink. Minimal bootstrap.

2. **Agent Loop** (`src/agent/loop.ts`) — Owns the message array. Drives the prompt → LLM → tool_calls → repeat cycle. Emits events into the shared bus. Handles context trimming on overflow. Unlimited turns by default.

3. **LLM Provider** (`src/agent/provider.ts`) — Wraps OpenAI Node SDK pointed at `https://api.kilo.ai/api/gateway`. Streams SSE events, accumulates text deltas and `tool_calls` deltas. Thin layer — the agent loop drives it.

4. **Tool Registry** (`src/tools/registry.ts`) — `Map<string, ToolHandler>`. Each handler has `name`, `description`, `parameters` (JSON Schema), and `execute(args) → Promise<string>`. Exports `getToolDefinitions()` for the LLM's `tools` parameter and `dispatch(name, args)` for execution.

5. **File Tool** (`src/tools/file.ts`) — Single registered tool with `action` dispatch. Five sub-actions:
   - `read`: resolve path, detect binary (null bytes in first 4KB), prefix lines, cap at 10K chars
   - `write`: create parent dirs, write content, return byte count
   - `edit`: exact string match, single-match enforcement, diff summary return
   - `glob`: resolve pattern, return matches sorted by mtime
   - `grep`: search files by pattern, cap at 200 results

6. **Bash Tool** (`src/tools/bash.ts`) — `child_process.spawn` with `shell: true`. Parameters: `command` (required), `workdir`, `env`, `timeout` (default 1800s), `yieldMs` (default 10s), `background` flag. Foreground: wait for exit, cap at 10K. Auto-background: detach after yieldMs. Explicit background: return sessionId immediately.

7. **Process Tool** (`src/tools/process.ts`) — In-memory `Map<sessionId, ProcessState>`. Actions: `list` (all sessions), `poll` (drain new output), `log` (offset/limit paging), `write` (stdin), `kill` (SIGTERM → SIGKILL), `clear` (remove finished). Sessions lost on restart — no disk persistence.

8. **Session Store** (`src/session/store.ts`) — JSON files in `~/.developer/sessions/`. Functions: `createSession`, `loadSession`, `appendMessages`, `listSessions`, `deleteSession`. Messages appended incrementally (file rewritten each time).

9. **Ink UI — Root** (`src/ui/app.tsx`) — `<App>` wraps `<EventBusProvider>`, renders `<MessageList>`, `<PromptInput>`, `<StatusBar>`.

10. **Ink UI — Components** (`src/ui/`) — Six components:
    - `message-list.tsx`: Virtual-scrolled, auto-scrolls to bottom
    - `message.tsx`: User messages (plain), assistant messages (streaming then final)
    - `tool-card.tsx`: Collapsible, color-coded by tool, header + body (collapsed/expanded), Ctrl+O toggle-all
    - `prompt-input.tsx`: Multi-line textarea, Shift+Enter newline, Enter submit, disabled while thinking
    - `status-bar.tsx`: Model name, status text, token count, keyboard hints

11. **Event Bus** — Type-safe pub/sub. Events: `agent:thinking`, `agent:token`, `agent:done`, `tool:start`, `tool:end`, `error`. React components subscribe via context provider. Agent loop emits into same bus.

### Architecture Decisions

- **In-process** — agent loop and UI share memory, communicate via event bus. No SSE server (contradicts OpenCode's approach; aligned with ADR-0001).
- **Auto-approve permission model** — all tool calls execute without user confirmation.
- **Output cap** — 10,000 characters on all tool output, with `[output truncated]` notice.
- **Plain-text error handling** — all tool errors returned as plain strings in the conversation, no structured `isError` mechanism.
- **Platform** — Primary development on Windows. `shell: true` uses `cmd.exe` on Windows, `/bin/sh` elsewhere. `DEVELOPER_SHELL=bash` env var for context detection.
- **Dependencies**: Ink ^5.0, React ^19, OpenAI ^4, uuid ^11, glob ^11. Dev: TypeScript ^5.8, tsx ^4.
- **No config file** for MVP — only env vars (`KILO_API_KEY`, `KILO_BASE_URL`) and CLI flags.

## Testing Decisions

All modules should be tested, focusing on external behavior rather than implementation details:

- **Agent Loop** — Test that a prompt produces the correct sequence: stream tokens, execute tools on `tool_calls` finish, loop back. Mock the provider. Verify context trimming fires at the right threshold.
- **LLM Provider** — Test that SSE chunks are correctly accumulated into text and tool_call deltas. Test error cases: network failure, auth error, malformed chunks.
- **Tool Registry** — Test that `dispatch` returns the right handler, that unknown names produce an error string, that `getToolDefinitions` returns valid JSON Schema.
- **File Tool** — Test each action independently: read with line numbers, read binary detection, write creating parent dirs, edit with exact match (success, not found, multiple matches), glob with patterns, grep with include filters.
- **Bash Tool** — Test foreground execution (exit codes, output capture, timeout), background execution (returns sessionId), auto-background after yieldMs, env var passing, workdir resolution.
- **Process Tool** — Test each action: list (empty, with sessions), poll (drains new output), log (offset/limit paging), write (stdin), kill (SIGTERM), clear (removes finished). Test that sessions are scoped per instance.
- **Session Store** — Test CRUD operations: create, load, append, list, delete. Test that sessions survive serialization round-trip. Test that session files are valid JSON.
- **Ink UI Components** — Test rendering at the component level with Ink's test utilities. Verify tool-card collapse/expand, color coding, status bar states, prompt input disabled state, message streaming updates.
- **Event Bus** — Test that events are delivered to all subscribers, that unsubscribing works, that no errors crash the loop.

### Prior Art

No existing tests in the codebase (greenfield project). Tests should follow standard patterns: use `vitest` or `node:test` for unit/integration tests, `@testing-library/ink` for UI component tests, and mock the Kilo Gateway provider (or use a thin test server) for agent loop tests.

## Out of Scope

- **Multi-client support** — no HTTP server, no web UI, no remote connections. The event bus abstraction enables extraction later without paying for it now.
- **Config file** — no `opencode.json`-style config for MVP. Environment variables and CLI flags only.
- **Slash commands** — `/help`, `/clear`, `/sessions`, `/exit` are future concerns.
- **Context compaction** — beyond simple oldest-message trimming, no summarization or compression.
- **Multi-agent / sub-agent recursion** — single agent only.
- **Browser tool** — no CDP-based automation.
- **Cross-platform PTY support** — Windows cmd.exe for MVP.
- **Package publishing** — not intended for npm distribution.

## Further Notes

- The project draws inspiration from OpenCode (unlimited turns, Ink TUI, event bus) and OpenClaw (bash tool with yieldMs/background, process tool with list/poll/log/write/kill/clear).
- Kilo Gateway provides native OpenAI-compatible tool calling with auto-repair (deduplication, orphan cleanup). The OpenAI Node SDK works directly with a `baseURL` override.
- DeepSeek V4 Flash: 284B total / 13B active params, 1M context, full native tool calling, OpenAI-compatible format, supports thinking mode.
