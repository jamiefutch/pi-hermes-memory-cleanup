# Agent Development Guidelines

## Role

You are a senior TypeScript/Node.js developer building tools that inspect, analyze, and safely clean Hermes persistent memory files used by the Pi coding agent.

## Development Process

Follow the agentic pattern when implementing any feature:

1. Write the code
2. Review the code
3. Test the code
4. Revise the code
5. Repeat until `npx tsc --noEmit` is clean and all vitest tests pass

## Code Quality Rules

- Keep functions small and focused (single responsibility)
- Prefer pure functions; isolate file-system side effects (see the plan/execute split in `prune.ts` and `dedupe.ts`)
- Add unit tests for every non-trivial function
- Use TypeScript strict mode; no `any` without explicit comment
- Validate all file paths before reading/writing
- Never delete user data without explicit confirmation or dry-run output
- Log every destructive operation with a clear before/after summary

## Hermes Data Layout

Hermes memory lives at `~/.pi/agent/pi-hermes-memory/`:

- `MEMORY.md` — global/project memories (injected into every session's context)
- `USER.md` — user preferences (injected)
- `failures.md` — failure/correction memories (injected)
- `retired-failures.md` — retired failure entries (not injected)
- `memory.db` — SQLite (currently empty in observed installs)
- `sessions.db` — session history SQLite (large)
- `.recovery-*` — automatic backup snapshots (see filename grammar below)
- `.<base>.retired-<ts>-<uuid>` — retired/consolidated entry snapshots
- `.consolidation-locks/` — consolidation lock database
- `.cleanup-backups/<ISO-ts>/` — backups created by THIS project's dedupe command; never prune these blindly

### Memory entry format

`MEMORY.md`, `USER.md`, and `failures.md` share one format:

- Entries are separated by a line containing only `§`
- Each entry ends with an optional metadata comment: `<!-- created=YYYY-MM-DD, last=YYYY-MM-DD -->`
- Parsing reference: `src/parse.ts`

### Recovery filename grammar

`.<base>.recovery-<epoch-ms>-<uuid>` — e.g. `.MEMORY.md.recovery-1786159192373-b792d013-a644-4561-830e-8434ac34d180`. Parsed by `parseRecoveryFilename` in `src/prune.ts`. Retired snapshots use the same shape with `.retired-` instead of `.recovery-`.

## Hermes Safety

Any cleanup script MUST:

1. Default to dry-run and show what would change
2. Require `--confirm` or user prompt before mutation
3. Back up affected files into `.cleanup-backups/` before modification
4. Report bytes/tokens saved and files touched

**Never hand-delete Hermes files.** Use the built-in CLI, which enforces the rules above:

- `npx tsx src/cli.ts prune [--keep N] [--confirm]` — removes old `.recovery-*` snapshots, always keeping the newest N per base file
- `npx tsx src/cli.ts dedupe [--confirm] [--remove FILE#IDX ...]` — backs up, then removes exact-dupe extras and superseded entries; never empties a file

Manual removal of `.recovery-*` / `.retired-*` files outside the CLI requires an explicit user request.

## Current Architecture

| Module | Purpose |
|--------|---------|
| `src/analyze.ts` | File discovery + storage size stats |
| `src/parse.ts` | Memory entry parser (`§` format, metadata, token estimates) |
| `src/dupes.ts` | Exact + near-duplicate detection (Jaccard/overlap) |
| `src/superseded.ts` | Superseded-entry detection (newer, larger container entry) |
| `src/prune.ts` | Recovery-file pruning (plan/execute) |
| `src/backup.ts` | Backup-before-mutation into `.cleanup-backups/` |
| `src/dedupe.ts` | Duplicate/superseded entry removal (plan/execute) |
| `src/cli.ts` | `report` / `prune` / `dedupe` subcommands |
| `extensions/pi-hermes-memory-cleanup.ts` | `/hermes-cleanup` pi command wrapping the CLI |

Published as `@jamiefutch/pi-hermes-memory-cleanup`. The `pi.extensions` manifest points at the exact file `extensions/pi-hermes-memory-cleanup.ts`.

## Documentation

Update this file and `locations.md` when project structure changes.
Update README.md whenever commands, behavior, or the extension change.
