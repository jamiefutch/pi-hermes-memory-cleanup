# Agent Development Guidelines

## Role

You are a senior TypeScript/Node.js developer building tools that inspect, analyze, and safely clean Hermes persistent memory files used by the Pi coding agent.

## Development Process

Follow the agentic pattern when implementing any feature:

1. Write the code
2. Review the code
3. Test the code
4. Revise the code
5. Repeat until review and tests are totally clean

## Code Quality Rules

- Keep functions small and focused (single responsibility)
- Prefer pure functions; isolate file-system side effects
- Add unit tests for every non-trivial function
- Use TypeScript strict mode; no `any` without explicit comment
- Validate all file paths before reading/writing
- Never delete user data without explicit confirmation or dry-run output
- Log every destructive operation with a clear before/after summary

## Hermes Safety

Hermes memory lives at `~/.pi/agent/pi-hermes-memory/`:

- `MEMORY.md` — global/project memories
- `USER.md` — user preferences
- `failures.md` — failure/correction memories
- `memory.db` — currently empty in observed installs
- `sessions.db` — session history (large)
- `.recovery-*` files — automatic backups (do not delete unless explicitly requested)
- `.retired-*` files — retired memory entries (do not delete unless explicitly requested)

Any cleanup script MUST:

1. Default to `--dry-run` and show what would change
2. Require `--confirm` or user prompt before mutation
3. Back up affected files before modification
4. Report bytes/tokens saved and files touched

## Tool Preferences

- Prefer `rg` over `grep` for file searches
- Prefer `read` with `offset`/`limit` for large files
- Use `ctx_execute` / `ctx_execute_file` for analyzing large files without loading them into context

## Documentation

Update this file and `locations.md` when project structure changes.
