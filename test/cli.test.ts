import { describe, it, expect } from 'vitest';
import { formatBytes } from '../src/cli.js';
import { totalSizeBytes } from '../src/analyze.js';

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('totalSizeBytes', () => {
  it('returns zero for empty paths', () => {
    expect(totalSizeBytes([])).toBe(0);
  });
});
