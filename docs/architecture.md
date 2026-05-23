# Developer — Architecture

## Overview

Developer is a CLI coding agent with three tools (`file`, `bash`, `process`) and an Ink-based terminal UI. It runs in a single Node.js process: the agent loop and the UI share memory, communicating through an event bus. LLM requests go through Kilo Gateway to DeepSeek v4 Flash.

```
┌─────────────────────────────────────────────────┐
│                    App (Ink)                     │
│  ┌───────────────────────────────────────────┐   │
│  │              MessageList                   │   │
│  │  ┌──────────┐  ┌──────────┐               │   │
│  │  │  System   │  │ ToolCard │  ...          │   │
│  │  │  Message  │  │ (collapsible)            │   │
│  │  └──────────┘  └──────────┘               │   │
│  └───────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────┐   │
│  │            PromptInput (multiline)         │   │
│  └───────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────┐   │
│  │              StatusBar                     │   │
│  └───────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────┘
                        │ events (pub/sub)
┌───────────────────────▼─────────────────────────┐
│                  Agent Loop                      │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ Kilo     │───▶│ Tool     │───▶│ Session  │   │
│  │ Gateway  │    │ Dispatch │    │ Store    │   │
│  │ Client   │    │          │    │          │   │
│  └──────────┘    └──────────┘    └──────────┘   │
│       │               │                          │
│       │         ┌─────┴──────┐                   │
│       │         │            │                   │
│       │    ┌────▼───┐  ┌────▼───┐               │
│       │    │  file   │  │  bash  │               │
│       │    │  tool   │  │  tool  │               │
│       │    └─────────┘  └───┬────┘               │
│       │                    │                      │
│       │              ┌─────▼──────┐               │
│       │              │  process   │               │
│       │              │  sessions  │               │
│       │              │  (memory)  │               │
│       │              └────────────┘               │
└───────────────────────────────────────────────────┘
```

---

## Directory Structure

```
developer/
├── src/
│   ├── index.ts                  # Entry: loads config, launches Ink
│   ├── app.tsx                   # Ink root component
│   │
│   ├── agent/
│   │   ├── loop.ts               # The agent loop (prompt → tools → repeat)
│   │   └── provider.ts           # Kilo Gateway HTTP client (OpenAI SDK)
│   │
│   ├── tools/
│   │   ├── registry.ts           # Tool registry: name → handler mapping
│   │   ├── file.ts               # File tool with action dispatch
│   │   ├── bash.ts               # Bash tool (spawn + capture)
│   │   └── process.ts            # Process session manager (in-memory)
│   │
│   ├── session/
│   │   └── store.ts              # Session persistence (JSON files)
│   │
│   └── ui/
│       ├── message-list.tsx      # Scrollable message history
│       ├── message.tsx           # Single message (user or assistant)
│       ├── tool-card.tsx         # Collapsible tool call display
│       ├── prompt-input.tsx      # Multi-line input component
│       └── status-bar.tsx        # Footer: model, status, key hints
│
├── package.json
├── tsconfig.json
└── CONTEXT.md
```

---

## Entry Point (`src/index.ts`)

```
parse CLI flags (--max-turns, --model, --session)
→ load or create session
→ render <App> with Ink
```

The entry is minimal. It parses optional CLI args, initializes the session store, and passes an `Agent` instance into Ink's context. Ink takes over the terminal until the user exits.

---

## Agent Loop (`src/agent/loop.ts`)

The agent loop is the central orchestration. It owns the message array and drives the conversation.

```
runAgent(prompt: string):
  1. push user message to messages[]
  2. session.autoSave()
  3. emit("agent:thinking")

  loop:
    4. send messages[] + tool definitions to Kilo Gateway (stream: true)
    5. stream text tokens → emit("agent:token") for Ink rendering
    6. if finish_reason === "tool_calls":
         a. for each tool_call in parallel:
              - emit("tool:start", { name, args })
              - handler = registry.get(tool_call.name)
              - result = handler.execute(tool_call.args)
              - emit("tool:end", { name, result })
              - push { role: "tool", content: result, tool_call_id } to messages[]
         b. session.autoSave()
         c. goto step 4
    7. if finish_reason === "stop":
         a. push { role: "assistant", content: fullText } to messages[]
         b. session.autoSave()
         c. emit("agent:done")
         d. return

  (unlimited turns — no counter unless --max-turns is set)
```

### Streaming details

Kilo Gateway streams SSE events. Each event is either:
- A `content` delta (text chunk) → rendered immediately via `emit("agent:token")`
- A `tool_calls` delta (function name + arguments JSON) → accumulated until the turn ends

When the stream ends with `finish_reason: "tool_calls"`, the accumulated tool calls are dispatched.

### Concurrency

Multiple tool calls from a single LLM response run **in parallel** (e.g., two `file read` calls at once). Their results are appended in the order the LLM issued them.

---

## Tool System (`src/tools/`)

### Registry (`registry.ts`)

A simple `Map<string, ToolHandler>`. Each handler implements:

```typescript
interface ToolHandler {
  name: string
  description: string
  parameters: JSONSchema    // for the LLM tool definition
  execute(args: Record<string, unknown>): Promise<string>
}
```

The registry exports `getToolDefinitions()` which returns the array sent to the LLM's `tools` parameter, and `dispatch(name, args)` which looks up and runs the handler.

### File Tool (`file.ts`)

A single registered tool with `action` as the first parameter. The action dispatcher routes to inner functions:

```
file.execute({ action, path, ...rest }):
  switch action:
    "read":
      - resolve path relative to cwd
      - if path is binary → return "[binary file]"
      - read file, prefix lines with line numbers
      - if content > 10K chars → truncate + append truncated notice
      - return content string

    "write":
      - create parent directories if needed (recursive mkdir)
      - write content to path
      - return "Written {path} ({N} bytes)"

    "edit":
      - read file at path
      - find oldString in content (exact match)
      - if not found → return error: "oldString not found"
      - if multiple matches → return error: "found N matches, provide more context"
      - replace with newString
      - write back
      - return diff summary

    "glob":
      - resolve pattern relative to cwd
      - return list of matching paths (sorted by mtime, newest first)
      - if empty → return "(no matches)"

    "grep":
      - search files matching path/include pattern
      - return lines with line numbers
      - cap at 200 results → append "(showing first 200 matches)"
```

The `read` action detects binary files by scanning for null bytes in the first 4KB. The `write` action never overwrites without explicit content — it always writes what the LLM provides. The `edit` action uses exact string matching (not regex) to keep the LLM's behavior predictable.

### Bash Tool (`bash.ts`)

```
bash.execute({ command, workdir?, env?, timeout?, yieldMs?, background? }):
  - spawn(command, { shell: true, cwd: workdir || session.cwd, env: { ...process.env, ...env } })
  - capture stdout + stderr into a combined buffer
  - if timeout: setTimeout(() => kill(), timeout * 1000)
  - if background === true:
      - detach into process session manager
      - return { status: "running", sessionId, output: (first 200 chars) }
  - if yieldMs is set and command runs longer than yieldMs:
      - auto-background: detach, return { status: "running", sessionId, output: (partial) }
  - else (foreground):
      - wait for exit
      - cap output at 10K chars
      - return { status: "exited", code, output }

  - on Windows: shell: true uses cmd.exe
  - on non-Windows: uses /bin/sh (or $SHELL)
  - spawned process receives DEVELOPER_SHELL=bash in env for context detection
```

### Process Tool (`process.ts`)

An in-memory `Map<sessionId, ProcessState>` manages background sessions.

```
ProcessState = {
  process: ChildProcess
  output: string[]        // line buffer for log/poll
  exitCode: number | null
  finished: boolean
  startedAt: number
}

process.execute({ action, sessionId?, data?, offset?, limit?, eof? }):
  switch action:
    "list":
      return all sessions with { sessionId, command, status, duration }

    "poll":
      - drain all new output since last poll
      - return { output, finished, exitCode }

    "log":
      - return output from offset to offset+limit
      - if no offset: return last 200 lines + paging hint
      - if offset but no limit: return from offset to end

    "write":
      - if process is running: write data + optional final newline to stdin
      - if eof: close stdin
      - return "Sent {N} bytes" or error if process exited

    "kill":
      - SIGTERM first, SIGKILL after 3s if still alive
      - return "Killed session {sessionId}"

    "clear":
      - remove finished session from map
      - return "Cleared session {sessionId}"
```

The output buffer stores lines as an array so `log` with offset/limit is O(1) slicing. Sessions are scoped to the agent instance — different sessions don't see each other's processes. On process restart, all sessions are lost (no disk persistence).

---

## Provider Client (`src/agent/provider.ts`)

Wraps the OpenAI Node SDK pointed at Kilo Gateway:

```typescript
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.KILO_API_KEY,
  baseURL: "https://api.kilo.ai/api/gateway",
})

async function streamCompletion(messages, tools, onToken, onToolCalls, onFinish):
  const stream = await client.chat.completions.create({
    model: "deepseek/deepseek-v4-flash",
    messages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: "auto",
    stream: true,
    max_tokens: 128000,   // generous cap for coding tasks
  })

  for await (const chunk of stream):
    if chunk.choices[0].delta.content:
      onToken(chunk.choices[0].delta.content)
    if chunk.choices[0].delta.tool_calls:
      accumulateToolCall(chunk.choices[0].delta.tool_calls)

  // stream ended
  if accumulatedToolCalls.length > 0:
    onToolCalls(accumulatedToolCalls)
    // finish_reason was "tool_calls"
  else:
    onFinish(accumulatedText)
```

The provider is a thin layer. It handles the streaming loop, token accumulation, and tool call assembly. The agent loop drives it.

API key is read from `KILO_API_KEY` environment variable. Missing key → error message on startup with instructions to set it.

---

## Session Store (`src/session/store.ts`)

```
directory: os.homedir() + "/.developer/sessions/"
file format: JSON, one file per session
file name: {sessionId}.json

SessionFile = {
  id: string          // uuid
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  messages: Message[]
}

Message = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string         // tool name for "tool" role messages
}

Functions:
- createSession(): creates new session file, returns sessionId
- loadSession(id): reads session file, hydrates messages
- appendMessages(sessionId, messages[]): appends to file, updates updatedAt
- listSessions(): returns { id, createdAt, messageCount } for all sessions
- deleteSession(id): removes session file
```

Messages are appended incrementally — the file is rewritten on every save (sessions are small, typically <100 messages).

---

## Ink UI Components

### `app.tsx` — Root
```
<App>
  <EventBusProvider>              ← shared event bus context
    <MessageList />               ← scrollable, follows bottom on new messages
    <PromptInput onsubmit={...} /> ← multi-line, Shift+Enter for newlines
    <StatusBar />                 ← model name, status, key hints
  </EventBusProvider>
</App>
```

### `message-list.tsx` — Message History
- Virtual-scrolled list of messages
- Auto-scrolls to bottom when new messages arrive
- Each message rendered by `message.tsx`
- System messages (tool calls, results) rendered as `tool-card.tsx`

### `message.tsx` — Single Message
- User messages: role label + content (plain text)
- Assistant messages: streaming text (updates token-by-token via event bus), then final rendered text
- If the assistant turn produced tool calls, they appear as embedded `ToolCard` components

### `tool-card.tsx` — Tool Call Display
- Collapsible block
- **Header**: tool name + status (running / done / error)
- **Body (collapsed)**: one-line summary of arguments + result status
- **Body (expanded)**: full arguments JSON + full output text
- Color-coded: file=blue, bash=green, process=yellow
- Ctrl+O toggles all tool cards expanded/collapsed (like Claude Code)

### `prompt-input.tsx` — Input Area
- Multi-line textarea (Shift+Enter = newline, Enter = submit)
- Submit disabled while agent is thinking
- Placeholder text when idle
- Empty submit is ignored

### `status-bar.tsx` — Footer
- Left: model name (`deepseek-v4-flash`)
- Center: status text (`idle`, `thinking`, `running tool: bash`, `streaming`)
- Right: token count (session total), keyboard shortcut hints

---

## Event Bus

A simple pub/sub that decouples the agent loop from the Ink UI:

```typescript
type Event =
  | { type: "agent:thinking" }
  | { type: "agent:token"; text: string }
  | { type: "agent:done" }
  | { type: "tool:start"; name: string; args: unknown }
  | { type: "tool:end"; name: string; result: string }
  | { type: "error"; message: string }
```

React components subscribe via a context provider. The agent loop emits into the same bus. This keeps the agent loop UI-agnostic — the same loop could drive a web UI or a raw readline interface without changes.

---

## Error Handling Strategy

| Layer | Error type | Handling |
|-------|-----------|----------|
| Provider | Network failure, auth error, rate limit | Return error as assistant message, stop loop |
| Tool | Invalid args, file not found, permission denied | Return error string as tool result (plain text) |
| Tool | Crash (uncaught exception in handler) | Catch, return `"Error: {message}"` as tool result |
| Agent loop | Message too long (context overflow) | Auto-trim oldest messages, retry once |
| Agent loop | Maximum turns reached (if `--max-turns` set) | Force text response: "Maximum turns reached" |
| UI | Render error | Ink error boundary, show fallback |

---

## Configuration

Minimal config — environment variables and CLI flags:

| Source | Key | Default | Description |
|--------|-----|---------|-------------|
| Env | `KILO_API_KEY` | — | Required. Kilo Gateway API key |
| Env | `KILO_BASE_URL` | `https://api.kilo.ai/api/gateway` | API endpoint |
| CLI | `--model` | `deepseek/deepseek-v4-flash` | Model ID |
| CLI | `--max-turns` | unlimited | Cap on agentic turns |
| CLI | `--session` | auto-create | Resume a saved session ID |

No config file for MVP. Can add `opencode.json`-style config later.

---

## Dependencies

```json
{
  "dependencies": {
    "ink": "^5.0.0",
    "react": "^19.0.0",
    "openai": "^4.0.0",
    "uuid": "^11.0.0",
    "glob": "^11.0.0",
    "ripgrep": "^0.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsx": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/uuid": "^10.0.0"
  }
}
```

`glob` and `ripgrep` are the engines behind the `file` tool's glob and grep actions. `openai` is the Node SDK for Kilo Gateway. `uuid` for session IDs. Ink + React for the TUI.

---

## Dev Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

`tsx` runs TypeScript directly with no build step — ideal for development iteration. `tsc` produces a `dist/` for stable runs.
