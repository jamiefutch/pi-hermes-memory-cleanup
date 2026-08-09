# Project File Locations

## This Project

- Root: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup`
- Source: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup/src`
- Tests: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup/test`
- Planning docs: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup/planning`
- Agent guidelines: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup/.pi/agents.md`
- This file: `/Users/jamiefutch/projects/personal/pi-hermes-memory-cleanup/.pi/locations.md`

## Hermes Reference Source

The canonical Hermes source is cloned at:

```
/projects/cloned/pi-hermes-memory
```

Key files to reference when building cleanup tools:

- `/projects/cloned/pi-hermes-memory/AGENTS.md` — Hermes agent guidelines
- `/projects/cloned/pi-hermes-memory/README.md` — project overview
- `/projects/cloned/pi-hermes-memory/PLAN.md` — architecture plan
- `/projects/cloned/pi-hermes-memory/src/` — source implementation
- `/projects/cloned/pi-hermes-memory/tests/` — tests

## Hermes Runtime Data (Target of Cleanup)

Hermes stores runtime persistent memory at:

```
~/.pi/agent/pi-hermes-memory/
```

Files of interest:

- `MEMORY.md` — global/project memories (loaded into context)
- `USER.md` — user preferences (loaded into context)
- `failures.md` — failure/correction memories (loaded into context)
- `memory.db` — SQLite database (currently empty in observed installs)
- `sessions.db` — session history SQLite database (large)
- `.recovery-*` — automatic backup snapshots of the markdown files
- `.retired-*` — retired/consolidated memory entries
- `.consolidation-locks/` — consolidation lock SQLite database

## Related Projects

- `/Users/jamiefutch/projects/personal/pi-chunk` — use as a structural guide for Pi-aware TypeScript projects
- `/Users/jamiefutch/projects/personal/opengrip` — related agentic .NET project
