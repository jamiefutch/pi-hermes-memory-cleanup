import { describe, it, expect } from 'vitest';
import { estimateTokens, parseMemoryMarkdown } from '../src/parse.js';

const SAMPLE = `First entry about rg usage. <!-- created=2026-08-13, last=2026-08-13 -->
§
Second entry about npm publish. <!-- created=2026-08-14, last=2026-08-14 -->
§
`;

describe('parseMemoryMarkdown', () => {
  it('splits entries on § separators', () => {
    const entries = parseMemoryMarkdown(SAMPLE, 'MEMORY.md');
    expect(entries).toHaveLength(2);
    expect(entries[0].index).toBe(0);
    expect(entries[1].index).toBe(1);
  });

  it('extracts created/last metadata', () => {
    const entries = parseMemoryMarkdown(SAMPLE, 'MEMORY.md');
    expect(entries[0].created).toBe('2026-08-13');
    expect(entries[0].last).toBe('2026-08-13');
  });

  it('handles entries without metadata', () => {
    const entries = parseMemoryMarkdown('plain entry\n', 'MEMORY.md');
    expect(entries).toHaveLength(1);
    expect(entries[0].created).toBeNull();
    expect(entries[0].last).toBeNull();
  });

  it('ignores empty chunks', () => {
    expect(parseMemoryMarkdown('§\n§\n', 'MEMORY.md')).toHaveLength(0);
  });

  it('records bytes and token estimate', () => {
    const entries = parseMemoryMarkdown('abcd efgh\n', 'MEMORY.md');
    expect(entries[0].bytes).toBe(9);
    expect(entries[0].estTokens).toBe(estimateTokens('abcd efgh'));
  });
});

describe('estimateTokens', () => {
  it('approximates 4 chars per token', () => {
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});
