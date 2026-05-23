# Real Integration Testing

## Purpose

Run the agent end-to-end against the live Kilo Gateway API to verify tools execute correctly, errors are handled gracefully, and a final response is produced. This is the only way to confirm the agent loop, LLM provider, and all tools work together in reality.

## Pattern

The test lives at `test/tools/real-integration.test.ts`. It:

1. Creates a temp workspace directory
2. Creates event bus, session store, tool registry, and shared session manager
3. Registers **all** tools (`file`, `bash`, `process`)
4. Subscribes to **all** event bus events and logs them to console:
   - `agent:thinking` — the prompt sent
   - `agent:token` — streamed text tokens (written to stdout)
   - `tool:start` — tool name + args
   - `tool:end` — tool name + result (first 200 chars)
   - `agent:done` — final assistant response
   - `error` — any errors
5. Creates a real provider using `KILO_API_KEY` (reads from `.env.local` or env var)
6. Creates an agent with all components + registry
7. Calls `agent.run(prompt)` with a multi-step task
8. Asserts that tool calls were made, a final response was produced, and files were created on disk

## Running

The test auto-skips if `KILO_API_KEY` is not available:

```bash
pnpm test -- test/tools/real-integration.test.ts
```

It requires `KILO_API_KEY` to be set (reads from `.env.local` automatically).

## Prompt Design

The prompt should be a multi-step task that exercises multiple tools in sequence. Example from `real-integration.test.ts`:

```
Run these steps in order:
1. Create a file called 'hello.txt' with content 'Hello from bash!'
2. Use bash to list files in the current directory
3. Read the file hello.txt
4. Edit hello.txt to replace 'bash' with 'agent'
5. Read hello.txt again to confirm the edit
6. Then tell me what you did
```

## Reading the Logs

The raw console output shows every event in real time. Key things to look for:

- `[TOOL:START]` — agent decided to call a tool, shows name + args
- `[TOOL:END]` — tool returned, shows name + result snippet
- `[DONE]` — agent produced final answer, the task completed
- `[ERROR]` — something crashed (should not happen in normal flow)
- `[THINKING]` — what prompt was sent to the LLM

The `workdir` for bash commands should be the actual workspace path, not `"."` (which resolves to the project root).
