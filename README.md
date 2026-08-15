# pi-hermes-memory-cleanup

A utility project for cleaning up and optimizing [Hermes](https://github.com/earendil-works/pi-coding-agent) persistent memory storage used by the Pi coding agent.

## Why

Hermes stores persistent memory as markdown files plus SQLite databases. Over time this accumulates:

- Duplicate memory entries
- Outdated recovery/retired backup files
- Bloated `failures.md` and `MEMORY.md` files
- Sessions database growth

This project provides scripts, tests, and guidance to safely audit and clean Hermes memory.

## Reference Source

The canonical Hermes source is cloned at:

```
/projects/cloned/pi-hermes-memory
```

Use this as the source of truth for how Hermes stores, consolidates, and loads memory.

## Project Structure

| Path | Purpose |
|------|---------|
| `.pi/agents.md` | Development guidelines for this agent |
| `.pi/locations.md` | Where files, source, and docs live |
| `src/` | Implementation (`analyze.ts` storage stats, `parse.ts` entry parser, `dupes.ts` duplicate detection, `superseded.ts` supersession detection, `cli.ts` report) |
| `test/` | Vitest tests |
| `planning/` | Notes and task lists |

## Development

```bash
# Install dependencies
npm install

# Read-only report against ~/.pi/agent/pi-hermes-memory
npm start

# Preview recovery-file pruning (keeps newest 10 per file)
npm run prune

# Actually prune (dry-run is the default; --confirm mutates)
npx tsx src/cli.ts prune --confirm --keep 5

# Preview duplicate/superseded entry removal
npm run dedupe

# Apply removal (backs up affected files first)
npx tsx src/cli.ts dedupe --confirm

# Manually remove specific entries by ref
npx tsx src/cli.ts dedupe --confirm --remove MEMORY.md#3 --remove USER.md#1

# Run tests
npm test

# Type check
npm run typecheck
```

## Safety

All mutating commands are **dry-run by default** and require `--confirm`. `dedupe --confirm` copies affected markdown files to `~/.pi/agent/pi-hermes-memory/.cleanup-backups/<timestamp>/` before rewriting, and never empties a file entirely. `prune` only touches `.recovery-*` files and always keeps the newest N per base file. Every command prints a before/after summary with bytes freed.

## Report Output

`npm start` (read-only) prints:

- **Storage stats** — sizes of `MEMORY.md`, `USER.md`, `failures.md`, recovery/retired backup files, and the SQLite databases
- **Memory entries** — per-file entry counts, bytes, and estimated injected-context tokens (~4 chars/token)
- **Stalest entries** — the five entries with the oldest `last=` activity dates
- **Duplicates** — exact duplicates (identical normalized text) and near-duplicates (Jaccard/overlap similarity ≥ 0.6 with ≥ 5 shared tokens)
- **Superseded entries** — older entries whose content is largely contained (overlap ≥ 0.7) in a strictly newer, larger entry; candidates for retirement

Entries are parsed from the standard Hermes markdown format: text blocks separated by `§` lines, with optional `<!-- created=YYYY-MM-DD, last=YYYY-MM-DD -->` metadata trailers.

## Pi Extension

Install the package (or keep the local path in `settings.json`) and use inside pi:

```
/memory-cleanup                        interactive menu (report / prune / dedupe)
/memory-cleanup report                 show the full report in the TUI
/memory-cleanup prune --keep 5         dry-run recovery prune
/memory-cleanup prune --confirm        delete old recovery files
/memory-cleanup dedupe --confirm       back up + remove duplicate/superseded entries
```

## License

MIT
