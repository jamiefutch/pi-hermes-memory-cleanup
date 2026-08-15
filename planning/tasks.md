# Development Tasks

## Phase 1: Project Foundation

- [x] Create project directory and base structure
- [x] Add `.gitignore`
- [x] Add `package.json` with TypeScript and Vitest
- [x] Add `tsconfig.json`
- [x] Add `vitest.config.ts`
- [x] Add `README.md`
- [x] Add `.pi/agents.md`
- [x] Add `.pi/locations.md` with cloned source path
- [x] Add basic source analysis module
- [x] Add CLI report module
- [x] Add initial tests
- [x] Install dependencies and run tests

## Phase 2: Hermes Analysis Tools

- [x] Read and parse `MEMORY.md`, `USER.md`, `failures.md` sections
- [x] Detect duplicate and near-duplicate memory entries
- [x] Detect outdated or superseded entries
- [x] Estimate token cost of each loaded entry
- [x] Report findings with entry IDs/previews

## Phase 3: Safe Cleanup Tools

- [x] Implement dry-run analysis mode
- [x] Implement backup before mutation
- [x] Implement duplicate removal with confirmation
- [x] Implement old recovery file archival (prune keeps newest N, `--confirm` required)
- [x] Report bytes and tokens saved

## Phase 4: Integration

- [x] Add npm scripts for report and cleanup
- [x] Document commands in README
- [ ] Add tests for all public functions
- [ ] Ensure all destructive operations require explicit confirmation
