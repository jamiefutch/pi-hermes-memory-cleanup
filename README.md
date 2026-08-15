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
| `src/` | Implementation (`analyze.ts` storage stats, `parse.ts` entry parser, `dupes.ts` duplicate detection, `cli.ts` report) |
| `test/` | Vitest tests |
| `planning/` | Notes and task lists |

## Development

```bash
# Install dependencies
npm install

# Run the analysis report against ~/.pi/agent/pi-hermes-memory
npm start

# Run tests
npm test

# Type check
npm run typecheck
```

## Report Output

`npm start` (read-only) prints:

- **Storage stats** — sizes of `MEMORY.md`, `USER.md`, `failures.md`, recovery/retired backup files, and the SQLite databases
- **Memory entries** — per-file entry counts, bytes, and estimated injected-context tokens (~4 chars/token)
- **Stalest entries** — the five entries with the oldest `last=` activity dates
- **Duplicates** — exact duplicates (identical normalized text) and near-duplicates (Jaccard/overlap similarity ≥ 0.6 with ≥ 5 shared tokens)

Entries are parsed from the standard Hermes markdown format: text blocks separated by `§` lines, with optional `<!-- created=YYYY-MM-DD, last=YYYY-MM-DD -->` metadata trailers.

## License

MIT
