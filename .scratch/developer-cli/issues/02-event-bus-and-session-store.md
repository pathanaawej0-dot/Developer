Status: ready-for-agent

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build two pieces of shared infrastructure that other slices depend on:

**Event bus**: A typed pub/sub system that decouples the agent loop from the Ink UI. Events: `agent:thinking`, `agent:token`, `agent:done`, `tool:start`, `tool:end`, `error`. Export a React context provider so Ink components can subscribe.

**Session store**: JSON file persistence for conversation history. Files stored at `~/.developer/sessions/` as `{sessionId}.json`. Each session has `id`, `createdAt`, `updatedAt`, `messages[]`. Messages follow the shape `{role, content, tool_call_id?, name?}`. Export: `createSession`, `loadSession`, `appendMessages`, `listSessions`, `deleteSession`.

Both modules are verified primarily through unit tests — no UI integration required yet.

## Acceptance criteria

- [ ] Event bus delivers events to all subscribers
- [ ] Unsubscribing from the event bus works and stops delivery
- [ ] React context provider wraps children and makes bus available via hook
- [ ] `createSession()` creates a valid session file on disk
- [ ] `loadSession(id)` hydrates messages correctly from disk
- [ ] `appendMessages()` appends and rewrites the file with updated `updatedAt`
- [ ] `listSessions()` returns metadata (id, createdAt, messageCount) for all sessions
- [ ] `deleteSession()` removes the session file
- [ ] All session operations handle missing files/IDs gracefully with plain-text errors
- [ ] `pnpm typecheck` passes

## Blocked by

- `01-scaffold-and-bare-ink-app` (needs project structure)
