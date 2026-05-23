Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build the PromptInput and StatusBar Ink components, and wire them together with the agent state from the event bus.

**PromptInput** (`src/ui/prompt-input.tsx`): Multi-line textarea.
- `Enter` submits the prompt (sends to agent loop).
- `Shift+Enter` inserts a newline (does not submit).
- Submit disabled while agent is thinking (`agent:thinking` event → disabled).
- Empty submit is ignored (no-op on blank/whitespace-only input).
- Placeholder text when idle (e.g., "Ask me anything...").

**StatusBar** (`src/ui/status-bar.tsx`): Footer bar displayed at the bottom of the terminal.
- Left: model name (`deepseek-v4-flash`).
- Center: status text that updates based on agent state (`idle`, `thinking`, `running tool: bash`, `streaming`).
- Right: token count for the current session + keyboard shortcut hints.

Both components subscribe to the event bus to react to state changes. The PromptInput needs to be wired to the agent loop's `runAgent(prompt)` call, which will be connected when all slices integrate.

## Acceptance criteria

- [ ] Enter submits, Shift+Enter inserts newline
- [ ] Input is disabled while agent is thinking
- [ ] Empty input is ignored (no submit)
- [ ] Placeholder text renders when idle
- [ ] StatusBar shows model name on the left
- [ ] StatusBar status text updates based on `agent:thinking`, `agent:token`, `tool:start`, `agent:done` events
- [ ] StatusBar shows token count on the right
- [ ] `pnpm typecheck` passes

## Blocked by

- `02-event-bus-and-session-store` (needs event bus context)
