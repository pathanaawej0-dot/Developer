Status: completed

## Parent

`.scratch/developer-cli/PRD.md`

## What to build

Set up the Node/TypeScript project scaffolding and a minimal Ink app that renders "Developer" to the terminal. This proves the entire build/run pipeline works before any logic is added.

- Create `package.json` with dependencies (ink, react, openai, uuid, glob) and dev dependencies (typescript, tsx, @types/react, @types/uuid).
- Create `tsconfig.json` targeting a modern ES version with JSX support for Ink.
- Create `src/index.ts` as entry point that renders a minimal `<App>` component via Ink.
- Create `src/ui/app.tsx` as a trivial Ink component that renders "Developer" (just the word).
- Verify `pnpm dev` launches the Ink app and displays "Developer" in the terminal.

No agent logic, no tools, no event bus, no session store — just a runnable Ink app.

## Acceptance criteria

- [x] `pnpm install` succeeds with all dependencies
- [x] `pnpm dev` (tsx watch) starts and shows "Developer" in the terminal
- [x] `pnpm typecheck` passes
- [x] `pnpm build` produces a dist/ folder
- [x] `pnpm start` runs the compiled output

## Blocked by

None — can start immediately
