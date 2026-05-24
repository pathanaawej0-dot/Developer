Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Wire CLI flags into the entry point to support session management and model selection.

**CLI entry** update (`src/index.tsx`): Parse these flags:
- `--session <id>`: Load an existing session instead of creating a new one. If the session file doesn't exist, show a clear error.
- `--model <model-id>`: Override the default model (`x-ai/grok-code-fast-1:optimized:free`).

**Session resume flow**: When `--session` is provided, load messages from the session file into the agent loop's message array. The conversation history is preserved and the LLM sees previous context.

**Integration**: The Ink app receives the session from the entry point and passes it to the agent loop via an `onSubmit` callback.

## Acceptance criteria

- [ ] `--session <id>` loads an existing session and resumes the conversation
- [ ] `--session <nonexistent>` shows a clear error message
- [ ] Without `--session`, a new session is created automatically
- [ ] `--model <model-id>` overrides the default model in the provider
- [ ] Default model is `x-ai/grok-code-fast-1:optimized:free` when no `--model` flag
- [ ] `pnpm typecheck` passes

## Blocked by

- `02-event-bus-and-session-store` (needs session store)
- `03-agent-loop-and-llm-provider` (needs the loop to modify)
