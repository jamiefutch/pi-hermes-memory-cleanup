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

- [ ] Read and parse `MEMORY.md`, `USER.md`, `failures.md` sections
- [ ] Detect duplicate and near-duplicate memory entries
- [ ] Detect outdated or superseded entries
- [ ] Estimate token cost of each loaded entry
- [ ] Report findings with entry IDs/previews

## Phase 3: Safe Cleanup Tools

- [ ] Implement dry-run analysis mode
- [ ] Implement backup before mutation
- [ ] Implement duplicate removal with confirmation
- [ ] Implement old recovery file archival (optional)
- [ ] Report bytes and tokens saved

## Phase 4: Integration

- [ ] Add npm scripts for report and cleanup
- [ ] Document commands in README
- [ ] Add tests for all public functions
- [ ] Ensure all destructive operations require explicit confirmation
