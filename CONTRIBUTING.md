# Contributing

Thanks for your interest in contributing to Developer!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b your-feature`
5. Make your changes
6. Run tests: `pnpm test`
7. Run typecheck: `pnpm typecheck`
8. Push and open a pull request

## Development Workflow

```bash
# Watch mode for rapid iteration
pnpm dev

# Run tests in watch mode
pnpm test:watch

# Type-check your changes
pnpm typecheck
```

## Code Style

- TypeScript with strict mode
- ESM modules (imports use `.js` extension)
- No semicolons
- Single quotes for strings
- 2-space indentation

The project uses `tsc --noEmit` for type checking. Make sure `pnpm typecheck` passes before committing.

## Testing

- Tests live in `test/` mirroring `src/` structure
- We use Vitest with ink-testing-library for UI components
- Run `pnpm test` to execute all tests
- Follow existing test patterns — focus on behavior, not implementation

## Project Structure

```
src/
├── agent/         — Agent loop and LLM provider
├── event-bus/      — Typed pub/sub system
├── session-store/  — JSON file persistence
├── ui/             — Ink React components
└── index.tsx      — CLI entry point
```

## Commit Messages

Use clear, descriptive commit messages. Prefix with the relevant module when applicable:

```
agent: stream tokens via onToken callback
event-bus: add React context provider
session-store: implement appendMessages
```

## Pull Requests

- Keep PRs focused on a single concern
- Include tests for new functionality
- Update documentation if needed
- Ensure `pnpm test` and `pnpm typecheck` pass

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.
