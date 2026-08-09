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
| `src/` | Implementation scripts |
| `test/` | Vitest tests |
| `planning/` | Notes and task lists |

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck
```

## License

MIT
