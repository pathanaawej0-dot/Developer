Status: completed

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build the tool registry and the file tool, then wire them into the agent loop so the LLM can read, write, edit, glob, and grep files.

**Tool Registry** (`src/tools/registry.ts`): A `Map<string, ToolHandler>`. Each handler has `name`, `description`, `parameters` (JSON Schema for the LLM tool definition), and `execute(args) → Promise<string>`. Export `getToolDefinitions()` (returns array for the LLM's `tools` parameter) and `dispatch(name, args)` (looks up handler, calls execute, returns result string). Unknown tool names return a plain-text error.

**File Tool** (`src/tools/file.ts`): Single tool with `action` parameter. Dispatch to five sub-handlers:
- `read`: Resolve path relative to cwd. Detect binary files (null bytes in first 4KB) → return `[binary file]`. Read text files, prefix lines with line numbers. Cap at 10K chars with `\n[output truncated]` appended.
- `write`: Create parent directories (recursive mkdir), write content, return `"Written {path} ({N} bytes)"`.
- `edit`: Read file, find `oldString` (exact match). If not found → `"oldString not found"`. If multiple matches → `"found N matches, provide more context"`. Replace with `newString`, write back, return diff summary.
- `glob`: Resolve pattern, return matches sorted by mtime (newest first). If no matches → `"(no matches)"`.
- `grep`: Search files by pattern with optional `include` filter. Return lines with line numbers. Cap at 200 results → append `"(showing first 200 matches)"`.

**Integration**: Wire registry into agent loop. When `finish_reason: "tool_calls"` arrives, dispatch each call via the registry, push results back to messages, and loop. Multiple parallel tool calls execute concurrently.

## Acceptance criteria

- [ ] Registry returns valid JSON Schema tool definitions for the LLM
- [ ] `dispatch("file", args)` routes to the correct sub-action
- [ ] `dispatch("nonexistent", args)` returns a plain-text error
- [ ] File `read` returns file content with line numbers
- [ ] File `read` detects binary files and returns `[binary file]`
- [ ] File `read` truncates at 10K chars with truncation notice
- [ ] File `write` creates parent directories if missing
- [ ] File `edit` succeeds on exact match, fails with clear message on no match or multiple matches
- [ ] File `glob` returns paths sorted by mtime
- [ ] File `grep` returns matches with line numbers, capped at 200
- [ ] Agent loop dispatches tool calls and returns results to the LLM
- [ ] Multiple tool calls from one LLM response run in parallel
- [ ] `pnpm typecheck` passes

## Blocked by

- `03-agent-loop-and-llm-provider` (needs the loop to dispatch tools)
