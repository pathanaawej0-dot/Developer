## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels with default string names. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: CONTEXT-MAP.md at root pointing to per-context CONTEXT.md files. See `docs/agents/domain.md`.

## Lessons Learned

### Tool definitions must use flat format (Responses API)

Kilo Gateway uses OpenAI Responses API (`client.responses.create`). Tool definitions must be flat:
```ts
{ type: "function", name: "foo", description: "...", parameters: {...} }
```
NOT nested like Chat Completions:
```ts
{ type: "function", function: { name: "foo", description: "...", parameters: {...} } }
```
The nested format causes 422 "Stealth model unable to process request".

### Build tool calls from streaming events, not response.completed

Order of streaming events for a tool call:
1. `response.output_item.added` — carries `item.name` (the function name) and `item.id`
2. `response.function_call_arguments.delta` — carries `arguments` chunks, keyed by `output_index`
3. `response.completed` — output items have **`output_index: undefined`**

Key tool call entries by `output_index` from the delta events. Do NOT create tool call entries from `response.completed` output — its `output_index` is `undefined` and creates duplicate entries alongside the correctly-keyed delta entries.
