Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Wire CLI flags into the entry point to support session management, turn limits, and model selection.

**CLI entry** update (`src/index.ts`): Parse these flags:
- `--session <id>`: Load an existing session instead of creating a new one. If the session file doesn't exist, show a clear error.
- `--max-turns <number>`: Cap the agent loop at this many turns. When reached, force a text response "Maximum turns reached" and stop.
- `--model <model-id>`: Override the default model (`deepseek/deepseek-v4-flash`).

**Session resume flow**: When `--session` is provided, load messages from the session file into the agent loop's message array. The conversation history is preserved and the LLM sees previous context.

**Max turns**: The agent loop checks a turn counter on each iteration. If `--max-turns` is set and the counter reaches it, the loop forces a final text response and does not execute further tool calls.

**Integration**: The Ink app receives the session and turn limit from the entry point and passes them to the agent loop. The StatusBar (from issue 07) should reflect the remaining turns when `--max-turns` is active.

## Acceptance criteria

- [ ] `--session <id>` loads an existing session and resumes the conversation
- [ ] `--session <nonexistent>` shows a clear error message
- [ ] Without `--session`, a new session is created automatically
- [ ] `--max-turns` caps the agent loop at the specified number of turns
- [ ] When max turns is reached, a final "Maximum turns reached" message is shown
- [ ] `--model <model-id>` overrides the default model in the provider
- [ ] Default model is `deepseek/deepseek-v4-flash` when no `--model` flag
- [ ] `pnpm typecheck` passes

## Blocked by

- `02-event-bus-and-session-store` (needs session store)
- `03-agent-loop-and-llm-provider` (needs the loop to modify)
