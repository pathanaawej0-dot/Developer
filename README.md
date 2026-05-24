# Developer

A terminal-based AI coding agent with a rich Ink TUI. Chat with 500+ LLMs through the Kilo Gateway in a Claude Code-like interface — right in your terminal.

```text
┌─────────────────────────────────────────────────────┐
│  x-ai/grok-code-fast-1:optimized:free    thinking   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  user                                              │
│    Create a file called hello.txt with 'Hello!'     │
│                                                     │
│  file (done)                                        │
│    Args: {"action":"write","path":"hello.txt"...}    │
│    Written hello.txt (7 bytes)                      │
│                                                     │
│  assistant                                         │
│    Done! Created hello.txt with "Hello!" inside.    │
│                                                     │
├─────────────────────────────────────────────────────┤
│ > Type your message...                  (Ctrl+D)    │
└─────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **🤖 Agent loop** — prompt → LLM → streamed response → auto-save. Unlimited turns by default.
- **🔧 Tool system** — read/write/edit/glob/grep files, run bash commands, manage background processes.
- **💬 Ink TUI** — beautiful terminal UI built with [Ink](https://github.com/vadimdemedes/ink) v5 + React.
- **🔌 500+ models** — access models from Anthropic, OpenAI, Google, xAI, DeepSeek, Mistral, and more via the [Kilo Gateway](https://kilo.ai/docs/gateway).
- **💸 Free tier** — works without an API key using free models (rate limited to 200 req/hr).
- **💾 Session persistence** — conversations auto-save to `~/.developer/sessions/`. Resume anytime with `--session`.
- **⚡ Streaming** — token-by-token streaming with SSE, real-time token count.
- **🔗 Event bus** — typed pub/sub decoupling the agent loop from the UI. React context provider included.
- **🛡️ Crash guard** — tool errors, provider failures, and context overflows are handled gracefully — no crashes.
- **📦 Background processes** — run long commands in the background, poll output, write stdin, kill when done.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 22
- **pnpm** (recommended) or npm

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/developer.git
cd developer

# Install dependencies
pnpm install
```

### Run without an API key (anonymous — free!)

```bash
pnpm build && pnpm start
```

> **No API key needed!** Developer uses `x-ai/grok-code-fast-1:optimized:free` by default — a free model available to everyone on the Kilo Gateway. Anonymous users get 200 requests per hour per IP.

You'll see:
```
Warning: KILO_API_KEY not set. Running in anonymous mode with free models (rate limited to 200 req/hr).
```

Then the TUI starts and you can start chatting.

### Run with your API key

1. Get a Kilo API key from [kilo.ai](https://kilo.ai) — sign up, add credits, copy your key.
2. Create `.env.local` in the project root:

```bash
echo "KILO_API_KEY=your_key_here" > .env.local
```

3. Build and start the app:

```bash
pnpm build && pnpm start
```

With a key you get access to all 500+ models — Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek, Mistral, Grok, and more.

---

## 📖 Usage

### TUI Interface

| Element | Description |
|---------|-------------|
| **Top bar** | Shows model name on the left, current status in the center, token count on the right |
| **Message list** | Chat history — user messages, assistant replies, tool call cards |
| **Tool cards** | Expandable cards showing tool name, arguments, and result output |
| **Prompt input** | Multi-line input at the bottom |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Submit your message |
| `Shift+Enter` | Insert a new line |
| `Ctrl+C` | Exit the application |
| *(typing)* | Input is disabled while the agent is thinking/streaming |

### CLI Options

| Flag | Description | Example |
|------|-------------|---------|
| `--model` | Model ID to use (default: `x-ai/grok-code-fast-1:optimized:free`) | `--model anthropic/claude-sonnet-4.6` |
| `--session` | Resume a previous session by ID | `--session abc123-def456` |

### Changing Models

Pass any model ID from the [Kilo Gateway models list](https://kilo.ai/docs/gateway/models-and-providers):

```bash
pnpm build && pnpm start -- --model nvidia/nemotron-3-super-120b-a12b:free
pnpm build && pnpm start -- --model anthropic/claude-sonnet-4.6
pnpm build && pnpm start -- --model openai/gpt-5.4-mini
```

The `--` separates pnpm's own flags from the flags passed to your script.

### Resuming a Session

```bash
# List your sessions
ls ~/.developer/sessions/

# Resume one
pnpm build && pnpm start -- --session <session-id-from-filename>
```

The session ID is the filename (minus `.json`). All messages from the previous conversation will be loaded into context.

### Headless Mode (no TUI)

For scripting or automated testing:

```bash
pnpm agent "write a file called hello.txt with content 'Hello from bash!'"
```

This runs the agent in non-interactive mode, streaming tokens to stdout and printing tool calls as they happen. A summary with token count and duration is printed at the end.

> **Note**: The headless agent script at `cli/agent.ts` currently requires `KILO_API_KEY`.

---

## 🛠️ Tools

### File Tool

Read, write, edit, glob, and grep files in your workspace.

| Action | Description |
|--------|-------------|
| `read` | Read a file with line numbers. Binary files return `[binary file]`. Output capped at 10K chars. |
| `write` | Create or overwrite a file. Creates parent directories automatically. |
| `edit` | Replace exact text in a file. Reports the line number of the change. |
| `glob` | List files matching a pattern. Sorted by modification time (newest first). |
| `grep` | Search file contents with regex. Supports path and include filters. Capped at 200 matches. |

### Bash Tool

Run shell commands in the foreground or background.

| Action | Description |
|--------|-------------|
| `foreground` | Run a command and wait for it to finish. Output capped at 10K chars. |
| `background` | Start a command and return immediately with a session ID. |

**Features:**
- **Timeout** — kill long-running commands after a specified number of milliseconds
- **Auto-background** — commands that run longer than `yieldMs` milliseconds are automatically moved to the background
- **Timeout + auto-cleanup** — a SIGKILL is sent 3 seconds after SIGTERM if the process hasn't exited

### Process Tool

Manage background process sessions created by the bash tool.

| Action | Description |
|--------|-------------|
| `list` | List all background process sessions |
| `poll` | Drain new output since last poll |
| `log` | Paginated log of all output (supports offset/limit) |
| `write` | Write text to a process's stdin |
| `kill` | Terminate a background process (SIGTERM → 3s → SIGKILL) |
| `clear` | Remove a finished session from the manager |

---

## 🛡️ Error Handling

Developer is built to be resilient in production use:

| Feature | Description |
|---------|-------------|
| **Output truncation** | All tool output is truncated at 10,000 characters with a `[output truncated]` notice |
| **Binary detection** | File reads scan the first 4KB for null bytes — binary files return `[binary file]` |
| **Context overflow** | If context length is exceeded, oldest messages are trimmed and the request is retried once |
| **Crash guard** | Every tool handler and provider call is wrapped in try/catch — errors return as text messages, not crashes |
| **Plain-text errors** | File not found, permission denied, bad arguments, and exit code 1 all return readable error strings |
| **Graceful startup** | Missing API key is a warning, not a fatal error — the app continues with free model access |

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in watch mode with `tsx` (may not work on all terminals) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled production build (`node dist/index.js`) |
| `pnpm build && pnpm start` | **Recommended** — build + run in one go |
| `pnpm test` | Run all tests (vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `pnpm agent` | Run headless agent for testing (`tsx cli/agent.ts <prompt>`) |

---

## 🏗️ Architecture

```
src/
├── agent/
│   ├── provider.ts      — LLM provider (OpenAI SDK → Kilo Gateway)
│   └── loop.ts          — Agent orchestration loop (prompt → LLM → tools → repeat)
├── tools/
│   ├── registry.ts      — Tool registry (Map<string, ToolHandler>, dispatch)
│   ├── file.ts          — File tool (read/write/edit/glob/grep)
│   ├── bash.ts          — Bash tool (foreground/background/auto-bg)
│   ├── process.ts       — Process tool (manage bg sessions: list/poll/log/write/kill)
│   └── session-manager.ts  — In-memory background process session map
├── session-store/
│   └── index.ts         — JSON file persistence in ~/.developer/sessions/
├── event-bus/
│   └── index.tsx        — Typed pub/sub + React context provider
├── cli/
│   └── parse-flags.ts   — --session and --model flag parser
├── ui/
│   ├── app.tsx          — Root Ink component (status, token tracking)
│   ├── message-list.tsx — Event-driven message list display
│   ├── message.tsx      — User/assistant message renderer
│   ├── tool-card.tsx    — Collapsible, color-coded tool call cards
│   ├── prompt-input.tsx — Multi-line input with Shift+Enter for newlines
│   └── status-bar.tsx   — Model name, agent status, token count
└── index.tsx            — CLI entry point

test/
├── agent/               — Provider and loop tests
├── tools/               — File, bash, process, registry, integration tests
├── session-store/       — Session persistence tests
├── event-bus/           — Event bus tests
├── cli/                 — Flag parser tests
└── ui/                  — App, message, tool-card, prompt-input, status-bar tests
```

### Data Flow

```
User prompt → prompt-input → agent.run()
  → session store (append user message)
  → LLM provider (stream tokens via SSE)
  → if tool_calls: tool registry (dispatch in parallel)
    → session store (append tool results)
    → loop back to LLM provider with tool results
  → if finish_reason "stop":
    → session store (append assistant response)
    → event bus (agent:done)
```

All communication between the agent loop and UI goes through the typed event bus.

### Event Bus Events

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:thinking` | `{ message }` | Agent started processing a prompt |
| `agent:token` | `{ token }` | Text token received from LLM |
| `agent:done` | `{ result }` | Agent finished responding |
| `tool:start` | `{ tool, args }` | Tool call started |
| `tool:end` | `{ tool, result }` | Tool call completed |
| `error` | `{ error }` | Error occurred (caught by crash guard) |

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm dev:test

# Run specific test file
pnpm vitest run test/agent/loop.test.ts

# Type checking only
pnpm typecheck
```

The test suite covers:
- **Agent loop** — prompt dispatch, token emission, tool execution, parallel tool calls, session auto-save, crash guard, context overflow
- **LLM provider** — API key handling, token streaming, tool call assembly (OpenAI SDK mocked)
- **Tools** — every file/bash/process action, error cases, truncation, binary detection
- **Session store** — CRUD operations, missing IDs
- **Event bus** — delivery, unsubscribe, React context
- **UI** — all components render correctly with event-driven updates
- **Integration** — full agent loop with real tool dispatch, real API integration tests

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 24+, TypeScript 5.8 (ESM) |
| **TUI** | [Ink](https://github.com/vadimdemedes/ink) v5 + React 18 |
| **LLM** | OpenAI SDK v4 → [Kilo Gateway](https://kilo.ai/docs/gateway) (Responses API) |
| **Testing** | [Vitest](https://vitest.dev) v3 + ink-testing-library |
| **Package manager** | pnpm |

### Key Design Decisions

- **Event bus decoupling** — the agent loop and UI communicate exclusively through typed events, making both independently testable
- **Tool registry pattern** — tools are registered handlers with JSON Schema parameters, making them LLM-friendly and extensible
- **Vertical slice files** — each tool is self-contained in a single file with its own config, actions, and exports
- **10K char cap** — all tool output is capped to prevent context overflow and keep the UI responsive
- **Auto-background** — long-running shell commands are automatically moved to background processes so the agent can continue working

---

## 📄 License

MIT
