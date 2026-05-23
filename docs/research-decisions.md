# Developer — Research & Key Decisions

## Project Overview

A practice project: a Claude Code-inspired CLI coding agent. Named **developer**. Three tools (`file`, `bash`, `process`), Ink-based TUI, LLM via Kilo Gateway + DeepSeek v4 Flash.

---

## Key Decisions

### 1. Runtime & Package Manager
- **Node 24.15.0** on Windows
- **pnpm 11.0.8**
- TypeScript throughout, no build step needed for dev (tsx runner)

### 2. CLI Framework
- **Ink** (React in terminal) — same approach as Claude Code itself
- Multi-line prompt input (Shift+Enter newline, Enter to send)
- Full tool card rendering: each tool invocation shown as a collapsible block with name, arguments, output
- Streaming assistant responses rendered token-by-token

### 3. Architecture
- **In-process** — agent loop lives in the same Node process as the Ink UI
- No separate server/SSE layer (unlike OpenCode's client-server split)
- Pub/sub event bus for Ink components to subscribe to agent events

### 4. Tools (exactly 3)

| Tool | Sub-actions | Purpose |
|------|-------------|---------|
| `file` | read, write, edit, glob, grep | All filesystem operations |
| `bash` | — | Run shell commands (foreground + background) |
| `process` | list, poll, log, write, kill, clear | Manage background bash sessions |

### 5. File Tool Design
- Single `file` tool with required `action` parameter (enum)
- Other params depend on the action:
  - `read`: path, offset?, limit?
  - `write`: path, content
  - `edit`: path, oldString, newString
  - `glob`: pattern, path?
  - `grep`: pattern, path?, include?
- Action dispatch in code routes to the right internal handler

### 6. Bash Tool Design
- `child_process.spawn` with `shell: true` — pipes, redirects, env vars all work
- Parameters: `command` (required), `workdir`?, `env`?, `timeout`? (default 1800s), `yieldMs`? (default 10s), `background`?
- Foreground: returns full output directly (capped at 10K chars)
- Background (auto after `yieldMs` or explicit `background: true`): returns `{ status: "running", sessionId, partialOutput }`
- Inspired by OpenClaw's `exec` tool

### 7. Process Tool Design
- In-memory map of sessionId → child process + output buffer
- Actions:
  - `list` — all sessions (running + finished)
  - `poll(sessionId)` — drain new output since last poll
  - `log(sessionId, offset?, limit?)` — read aggregated output with paging
  - `write(sessionId, data, eof?)` — send stdin to running process
  - `kill(sessionId)` — terminate
  - `clear(sessionId)` — remove finished session from memory
- Sessions scoped per agent; lost on restart (no disk persistence)
- Inspired by OpenClaw's `process` tool

### 8. Permission Model
- **Auto-approve all** — every tool call executes immediately
- No y/n prompts, no allowlists

### 9. Agent Loop
- Multi-line prompt → LLM (Kilo Gateway → DeepSeek v4 Flash)
- If `finish_reason: "tool_calls"` → execute tool(s) → append results → loop
- If text response → render in Ink. Turn complete.
- **Unlimited turns** by default (both Claude Code and OpenCode use this)
- Optional `--max-turns` flag for non-interactive cost control
- Streaming enabled (SSE from Kilo Gateway)

### 10. Output Cap
- Tool output truncated at **10,000 characters**
- Large output gets `\n[output truncated]` appended
- Agent can use `process log` with offset/limit to page through

### 11. Error Handling
- All tool errors returned as **plain text** in the result content
- Exit code 1, ENOENT, permission denied → all plain strings
- No structured `isError` mechanism

### 12. Session Persistence
- Auto-save after every turn
- Location: `~/.developer/sessions/`
- Format: JSON file per session
- Fields: `{ id, createdAt, updatedAt, messages[] }`
- Each message: `{ role, content, toolCallId?, toolName? }`

### 13. LLM Provider
- **Kilo Gateway** at `https://api.kilo.ai/api/gateway`
- OpenAI-compatible API (OpenAI Node SDK with base URL override)
- Model: `deepseek/deepseek-v4-flash` (Kilo format)
- Native `tools`/`tool_choice`/`tool_calls` support — standard agent loop

### 14. Platform
- Primary development on **Windows** (spawn uses cmd.exe via shell: true)

---

## Research Sources

- **Kilo Gateway API**: Native OpenAI-compatible tool calling with auto-repair (deduplication, orphan cleanup). Vercel AI SDK + OpenAI SDK both work via base URL override.
- **DeepSeek V4 Flash**: Full native tool calling. 284B total / 13B active params. 1M context. OpenAI-compatible format. Supports thinking mode.
- **OpenCode**: Unlimited turns default. `steps` per-agent config. Client-server SSE architecture. Ink-based TUI.
- **Claude Code**: Unlimited turns default. `maxTurns`/`maxBudgetUsd` optional. SDK enforces at 10 when not set programmatically. Sub-agent recursion depth limit of 10.
- **OpenClaw**: `exec` tool with `yieldMs`/`background` foreground→background transition. `process` tool with list/poll/log/write/kill/clear. Single `browser` tool with action dispatch.

---

## Future Considerations (not MVP)

- `--max-turns` CLI flag
- Slash commands (`/help`, `/clear`, `/sessions`, `/exit`)
- Context compaction (when history grows large)
- `DEVELOPER.md` project context auto-injection
- Multi-agent (sub-agent spawning)
- Browser tool (CDP-based automation)
- Cross-platform PTY support
