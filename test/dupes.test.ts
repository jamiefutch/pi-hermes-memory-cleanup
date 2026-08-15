import { describe, it, expect } from 'vitest';
import { findDuplicates, jaccard, normalizeText } from '../src/dupes.js';
import { parseMemoryMarkdown } from '../src/parse.js';

function entriesOf(...texts: string[]) {
  return parseMemoryMarkdown(texts.join('\n§\n'), 'MEMORY.md');
}

describe('normalizeText', () => {
  it('strips html comments, lowercases, collapses whitespace', () => {
    expect(normalizeText('Hello   WORLD <!-- created=x -->')).toBe('hello world');
  });
});

describe('jaccard', () => {
  it('is 1 for identical sets', () => {
    const s = new Set(['alpha', 'beta']);
    expect(jaccard(s, s)).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccard(new Set(['alpha']), new Set(['omega']))).toBe(0);
  });
});

describe('findDuplicates', () => {
  it('finds exact duplicates ignoring metadata comments', () => {
    const entries = entriesOf(
      'same entry text here <!-- created=2026-08-13 -->',
      'same entry text here <!-- created=2026-08-14, last=2026-08-14 -->',
    );
    const report = findDuplicates(entries);
    expect(report.exact).toHaveLength(1);
    expect(report.exact[0]).toHaveLength(2);
    expect(report.near).toHaveLength(0); // exact pairs are not double-reported
  });

  it('finds near duplicates above the threshold', () => {
    const entries = entriesOf(
      'agents.md guidance for pi projects always update readme on significant changes',
      'agents.md guidance for pi projects always update readme on significant changes and verify work',
    );
    const report = findDuplicates(entries, 0.7);
    expect(report.exact).toHaveLength(0);
    expect(report.near).toHaveLength(1);
    expect(report.near[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  it('reports nothing for distinct entries', () => {
    const entries = entriesOf(
      'completely different topic about typescript config',
      'unrelated note regarding npm authentication tokens',
    );
    const report = findDuplicates(entries);
    expect(report.exact).toHaveLength(0);
    expect(report.near).toHaveLength(0);
  });
});
