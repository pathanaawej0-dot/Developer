Status: completed

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build the bash tool and process tool, then wire them into the agent loop so the LLM can run shell commands and manage long-running background processes.

**Bash Tool** (`src/tools/bash.ts`): Uses `child_process.spawn` with `shell: true`. Parameters: `command` (required), `workdir`, `env`, `timeout` (default 1800s), `yieldMs` (default 10s), `background` flag.
- Foreground mode: Wait for exit, cap output at 10K chars, return `{ status: "exited", code, output }`.
- Auto-background: If the command runs longer than `yieldMs`, detach into process session manager, return `{ status: "running", sessionId, output: first 200 chars }`.
- Explicit background (`background: true`): Return sessionId immediately without waiting.
- Spawned process receives `DEVELOPER_SHELL=bash` env var for context detection.
- On Windows: `shell: true` uses `cmd.exe`. On non-Windows: uses `/bin/sh`.

**Process Tool** (`src/tools/process.ts`): In-memory `Map<sessionId, ProcessState>`. Each session tracks the `ChildProcess`, an output buffer (lines array for O(1) slicing), exit code, finished flag, and start time. Actions:
- `list`: All sessions with `{ sessionId, command, status, duration }`.
- `poll(sessionId)`: Drain new output since last poll. Return `{ output, finished, exitCode }`.
- `log(sessionId, offset?, limit?)`: Return output from offset to offset+limit. No offset → last 200 lines + paging hint.
- `write(sessionId, data, eof?)`: Write to stdin. If eof, close stdin. Return `"Sent {N} bytes"`.
- `kill(sessionId)`: SIGTERM first, SIGKILL after 3s. Return `"Killed session {sessionId}"`.
- `clear(sessionId)`: Remove finished session from map. Return `"Cleared session {sessionId}"`.

Sessions are scoped per agent instance; lost on restart.

## Acceptance criteria

- [ ] Bash foreground runs a command and returns output with exit code
- [ ] Bash auto-backgrounds after yieldMs and returns a sessionId
- [ ] Bash explicit background (`background: true`) returns sessionId immediately
- [ ] Bash timeout kills the process after the specified duration
- [ ] Bash sets `DEVELOPER_SHELL=bash` env var in the spawned process
- [ ] Bash output is capped at 10K chars
- [ ] Process `list` shows running and finished sessions
- [ ] Process `poll` returns new output since last poll
- [ ] Process `log` supports offset/limit paging
- [ ] Process `write` sends data to stdin
- [ ] Process `kill` terminates a running process (SIGTERM then SIGKILL)
- [ ] Process `clear` removes a finished session
- [ ] Invalid sessionIds across all actions return plain-text errors
- [ ] Agent loop can call bash tool and process tool via the registry
- [ ] `pnpm typecheck` passes

## Blocked by

- `03-agent-loop-and-llm-provider` (needs the loop to dispatch tools)
