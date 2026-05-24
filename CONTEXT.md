# Developer

A practice project: a Claude Code-inspired CLI agent with three tools (`file`, `bash`, `process`) that talks to DeepSeek v4 Flash via the Kilo Gateway.

## Language

**Agent**:
A Node-based LLM agent loop that receives a prompt, calls tools, and streams responses back. Runs in-process with the Ink UI.
_Avoid_: Worker, runtime, server

**File tool**:
A single tool with sub-actions (`read`, `write`, `edit`, `glob`, `grep`) for all filesystem operations. Keeps the agent's tool list compact.
_Avoid_: Read tool, Write tool, Edit tool (they are not separate tools)

**Bash tool**:
Runs shell commands via `child_process.spawn`. Supports foreground execution (returns output directly) and background mode (returns a session ID for later polling via the `process` tool).

**Process tool**:
Manages background `bash` sessions. Actions: `list`, `poll`, `log` (with offset/limit), `write` (stdin), `kill`, `clear`.

**CLI**:
An Ink-based terminal UI with multi-line prompt input, full tool card rendering for each tool invocation, and streaming assistant responses.

**Kilo Gateway**:
An OpenAI-compatible API proxy at `https://api.kilo.ai/api/gateway`. The single point of contact for all LLM requests. Routes to DeepSeek v4 Flash.

**Session**:
A conversation saved to `~/.developer/sessions/` as JSON. Each session has an ID, message history, and metadata. Auto-saved after every turn.

**Tool result**:
The output of a tool execution, returned as a plain string in the conversation. Errors (exit codes, missing files) are also plain strings — not structured error objects.
_Avoid_: isError, tool error

**Turn limit**:
Unlimited by default — the agent runs tool calls until it decides to respond or the user interrupts.

**Output cap**:
Tool output is truncated at 10,000 characters. If a `bash` command produces more, only the first 10K chars are returned with `\n[output truncated]`.

**Agent loop**:
User prompt → LLM (via Kilo Gateway) → if `tool_calls`: execute tool, append result, loop → if text only: render and stop. Streaming enabled. Unlimited turns.

**Permission model**:
Auto-approve all — every tool call executes immediately without user confirmation.

## Example dialogue

**Dev**: "How do we handle when bash produces 100K lines?"
**Domain expert**: "Output cap at 10K chars. If the agent needs more, it uses `process log` with offset/limit to page through the rest."
**Dev**: "What if bash exits with code 1?"
**Domain expert**: "It's a tool result like any other — a plain string. The LLM reads 'exit code 1' and decides what to do."
