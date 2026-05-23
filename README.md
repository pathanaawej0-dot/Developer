# Developer

A terminal-based AI coding agent with an Ink TUI. Chat with LLMs (DeepSeek, Grok, etc.) through the Kilo Gateway in a Claude Code-like interface — all in your terminal.

## Features

- **Agent loop** — prompt → LLM → streamed response → auto-save. Unlimited turns by default.
- **LLM provider** — wraps the OpenAI SDK pointed at the Kilo Gateway. SSE streaming, token-by-token output.
- **Event bus** — typed pub/sub decoupling the agent loop from the UI. React context provider included.
- **Session store** — conversation history auto-saves to `~/.developer/sessions/` as JSON.
- **Ink TUI** — [Ink](https://github.com/vadimdemedes/ink) v5 terminal UI with React components.
- **Tool system** (coming in later slices) — file read/write/edit/glob/grep, bash execution, process management.

## Prerequisites

- Node.js >= 22
- A [Kilo](https://kilo.ai) account with API credits
- `KILO_API_KEY` environment variable

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd developer

# Install dependencies
pnpm install

# Set your API key
# Create .env.local in the project root:
echo "KILO_API_KEY=your_key_here" > .env.local

# Start development mode (tsx watch)
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in watch mode with tsx |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled production build |
| `pnpm test` | Run all tests (vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript type checking |

## Architecture

```
src/
├── agent/
│   ├── provider.ts    — LLM provider (OpenAI SDK → Kilo Gateway)
│   └── loop.ts        — Agent orchestration loop
├── event-bus/
│   └── index.tsx       — Typed pub/sub + React context
├── session-store/
│   └── index.ts        — JSON file persistence
├── ui/
│   └── app.tsx         — Ink app root component
└── index.tsx           — CLI entry point
```

### Agent Loop

The agent loop owns the conversation history. When you submit a prompt:
1. User message is appended and auto-saved
2. Full history is sent to the LLM provider
3. Tokens stream back through the event bus (`agent:token` events)
4. On `finish_reason: "stop"`, the assistant response is saved
5. On `finish_reason: "tool_calls"`, the loop pauses (tools come in later slices)

### LLM Provider

Wraps the OpenAI Node.js SDK pointed at `https://api.kilo.ai/api/gateway`. Uses the Responses API (OpenAI-compatible). Default model: `x-ai/grok-code-fast-1:optimized:free`. Set `KILO_API_KEY` in your environment or pass `apiKey` in the config.

### Event Bus

Type-safe publish/subscribe system. Events: `agent:thinking`, `agent:token`, `agent:done`, `tool:start`, `tool:end`, `error`. React components subscribe via the `EventBusProvider` context.

### Session Store

Conversations persist as JSON files in `~/.developer/sessions/`. Each session has an `id`, `createdAt`, `updatedAt`, and `messages[]`.

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **TUI**: [Ink](https://github.com/vadimdemedes/ink) v5 + React 18
- **LLM**: OpenAI SDK v4 → Kilo Gateway
- **Testing**: Vitest + ink-testing-library
- **Package manager**: pnpm

## License

MIT
