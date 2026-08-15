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
| `src/` | Implementation (`analyze.ts` storage stats, `parse.ts` entry parser, `dupes.ts` duplicate detection, `superseded.ts` supersession detection, `prune.ts` recovery pruning, `dedupe.ts` entry removal, `limits.ts` injection caps, `trim.ts` entry picker planning, `cli.ts` report) |
| `test/` | Vitest tests |
| `planning/` | Notes and task lists |

## Development

```bash
# Read-only report against ~/.pi/agent/pi-hermes-memory
npm start

# Configured injection caps vs actual usage
npx tsx src/cli.ts limits

# Pick specific entries to stop injecting (dry-run default)
npx tsx src/cli.ts trim --confirm --remove MEMORY.md#3 --remove USER.md#1

# Preview recovery-file pruning (keeps newest 10 per file)
npm run prune

# Actually prune (dry-run is the default; --confirm mutates)
npx tsx src/cli.ts prune --confirm --keep 5

# Preview duplicate/superseded entry removal
npm run dedupe

# Apply removal (backs up affected files first)
npx tsx src/cli.ts dedupe --confirm

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
- **Per-request injection** — what the model actually receives every request, computed from your Hermes mode: `policy-only` injects just the policy prompt + standing instructions (markdown files are tool-searchable, zero per-request cost); `legacy-inject` injects full file contents
- **Memory files on disk** — per-file entry counts, bytes, and estimated tokens, labeled injected vs. tool-searchable per your mode
- **Stalest entries** — the five entries with the oldest `last=` activity dates
- **Largest entries** — the five entries with the highest estimated token cost
- **Duplicates** — exact duplicates (identical normalized text) and near-duplicates (Jaccard/overlap similarity ≥ 0.6 with ≥ 5 shared tokens)
- **Superseded entries** — older entries whose content is largely contained (overlap ≥ 0.7) in a strictly newer, larger entry; candidates for retirement

`limits` shows Hermes injection configuration (`~/.pi/agent/hermes-memory-config.json`): `memoryMode`, `memoryPolicyStyle`, per-file char caps vs actual usage with near-cap warnings, and the failures.md injection filters (max age / max entries).

Entries are parsed from the standard Hermes markdown format: text blocks separated by `§` lines, with optional `<!-- created=YYYY-MM-DD, last=YYYY-MM-DD -->` metadata trailers.

## Pi Extension

Install the package (or keep the local path in `settings.json`) and use inside pi:

The menu tags each operation by blast radius: **⚡ affects injected context** (trim, dedupe), **💽 disk only** (prune), untagged entries are read-only views.

```
/memory-cleanup                        interactive menu (report / limits / trim / dedupe / prune)
/memory-cleanup report                 show the full report in the TUI
/memory-cleanup limits                 injection caps vs usage
/memory-cleanup trim --confirm --remove MEMORY.md#3
                                       remove specific entries (backs up first)
/memory-cleanup dedupe --confirm       back up + remove duplicate/superseded entries
/memory-cleanup prune --confirm        delete old recovery files
```

## License

MIT
