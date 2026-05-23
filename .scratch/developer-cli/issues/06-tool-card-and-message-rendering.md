Status: completed

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Build the Ink UI components for displaying messages and tool calls, integrated with the event bus. This slice delivers the core visual UX.

**ToolCard** (`src/ui/tool-card.tsx`): A collapsible block per tool invocation.
- Header: tool name + status (running / done / error).
- Body (collapsed): one-line summary of arguments + result status.
- Body (expanded): full arguments JSON + full output text.
- Color-coded by tool type: file=blue, bash=green, process=yellow.
- Keyboard shortcut `Ctrl+O` toggles all tool cards expanded/collapsed.

**Message** (`src/ui/message.tsx`): Renders a single message.
- User messages: role label + content (plain text).
- Assistant messages: streaming text (updates token-by-token via event bus `agent:token`), then final rendered text.
- If the assistant turn produced tool calls, they appear as embedded ToolCard components.

**MessageList** (`src/ui/message-list.tsx`): Virtual-scrolled list of messages. Auto-scrolls to bottom when new messages arrive. Each message rendered by `message.tsx`. System messages (tool calls, results) rendered as `tool-card.tsx`.

All components subscribe to the event bus via React context. When the agent loop emits events, the UI reacts.

## Acceptance criteria

- [ ] ToolCard renders with tool name and status in the header
- [ ] ToolCard collapses/expands on click
- [ ] ToolCard is color-coded by tool type (file=blue, bash=green, process=yellow)
- [ ] `Ctrl+O` toggles all tool cards
- [ ] User messages display with role label and content
- [ ] Assistant messages stream text token-by-token via event bus
- [ ] Assistant messages with tool calls show embedded ToolCards
- [ ] MessageList auto-scrolls to bottom on new messages
- [ ] MessageList renders a scrollable list without performance issues
- [ ] `pnpm typecheck` passes

## Blocked by

- `02-event-bus-and-session-store` (needs event bus context)
