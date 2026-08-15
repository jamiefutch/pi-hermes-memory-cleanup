import { describe, it, expect } from 'vitest';
import { findSuperseded } from '../src/superseded.js';
import { parseMemoryMarkdown } from '../src/parse.js';

function entriesOf(...texts: string[]) {
  return parseMemoryMarkdown(texts.join('\n§\n'), 'MEMORY.md');
}

describe('findSuperseded', () => {
  it('flags an older entry whose content is contained in a newer, larger entry', () => {
    const entries = entriesOf(
      'agents.md guidance for pi projects always update readme <!-- created=2026-08-13, last=2026-08-13 -->',
      'agents.md guidance for pi projects always update readme on significant changes and verify work note pi is gitignored <!-- created=2026-08-14, last=2026-08-14 -->',
    );
    const result = findSuperseded(entries);
    expect(result).toHaveLength(1);
    expect(result[0].entry.index).toBe(0);
    expect(result[0].supersededBy.index).toBe(1);
    expect(result[0].overlap).toBeGreaterThanOrEqual(0.7);
  });

  it('does not flag when the containing entry is older', () => {
    // Entry 0 is OLDER but contains entry 1's content — must NOT flag,
    // because supersession requires the container to be strictly newer.
    const entries = entriesOf(
      'extended content about readme updates and verification work for pi projects <!-- created=2026-08-13, last=2026-08-13 -->',
      'readme updates and verification for pi projects <!-- created=2026-08-14, last=2026-08-14 -->',
    );
    expect(findSuperseded(entries)).toHaveLength(0);
  });

  it('does not flag an equal-size restatement (container must add content)', () => {
    const entries = entriesOf(
      'npm publish registry propagation delay verify via npm view after waiting <!-- created=2026-08-13 -->',
      'npm publish registry propagation delay verify via npm view after waiting! <!-- created=2026-08-14 -->',
    );
    expect(findSuperseded(entries)).toHaveLength(0);
  });

  it('does not flag distinct entries', () => {
    const entries = entriesOf(
      'typescript configuration for strict mode projects <!-- created=2026-08-13 -->',
      'npm two factor authentication token setup instructions <!-- created=2026-08-14 -->',
    );
    expect(findSuperseded(entries)).toHaveLength(0);
  });

  it('skips entries without created metadata', () => {
    const entries = entriesOf(
      'plain entry with no metadata at all here today',
      'plain entry with no metadata at all here today plus extra words <!-- created=2026-08-14 -->',
    );
    expect(findSuperseded(entries)).toHaveLength(0);
  });
});
