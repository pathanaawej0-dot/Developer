Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build the core agent loop and LLM provider, then wire them into the Ink UI so typing a prompt sends it to DeepSeek v4 Flash via Kilo Gateway and streams the response back token-by-token. No tools yet — just text-in, text-out.

**LLM Provider** (`src/agent/provider.ts`): Wrap the OpenAI Node SDK pointed at `https://api.kilo.ai/api/gateway`. Accept messages array + tool definitions, stream SSE responses, accumulate text deltas and `tool_calls` deltas. Use `KILO_API_KEY` env var for auth; show a clear startup error if missing.

**Agent Loop** (`src/agent/loop.ts`): Own the message array. On user prompt: push to messages, auto-save, send to provider. If stream ends with `finish_reason: "stop"`, push assistant message, auto-save, emit `agent:done`, render. If `finish_reason: "tool_calls"`, for now just handle it as a no-op (tools come in later slices). Unlimited turns by default. Emit events into the event bus (`agent:thinking`, `agent:token`, `agent:done`).

**Ink integration**: The PromptInput (from issue 07) sends text to the agent loop. Streaming tokens render in a message component below. This slice proves the full prompt→LLM→render pipeline works.

## Acceptance criteria

- [ ] `KILO_API_KEY` env var is read; missing key shows clear error message on startup
- [ ] Provider streams text tokens via SSE and emits them via `onToken` callback
- [ ] Provider accumulates `tool_calls` deltas from the stream
- [ ] Agent loop sends user message → LLM → receives streamed response → emits tokens
- [ ] Agent loop auto-saves after each turn
- [ ] Agent loop handles `finish_reason: "stop"` correctly (no crash)
- [ ] Agent loop handles `finish_reason: "tool_calls"` without crashing (tools not wired yet)
- [ ] Streaming text appears token-by-token in the Ink UI
- [ ] `pnpm typecheck` passes

## Blocked by

- `02-event-bus-and-session-store` (events + session saving needed)
