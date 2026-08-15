import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadHermesLimits, computeUsage } from '../src/limits.js';
import { planTrim, entriesByCost } from '../src/trim.js';
import { parseMemoryMarkdown } from '../src/parse.js';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-limits-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('loadHermesLimits', () => {
  it('returns defaults when config file is missing', () => {
    const l = loadHermesLimits(path.join(tmp, 'nope.json'));
    expect(l.memoryCharLimit).toBe(5000);
    expect(l.memoryMode).toBe('policy-only');
  });

  it('merges overrides and ignores invalid values', () => {
    const p = path.join(tmp, 'cfg.json');
    fs.writeFileSync(p, JSON.stringify({ memoryCharLimit: 3000, memoryPolicyStyle: 'none', userCharLimit: -5 }));
    const l = loadHermesLimits(p);
    expect(l.memoryCharLimit).toBe(3000);
    expect(l.memoryPolicyStyle).toBe('none');
    expect(l.userCharLimit).toBe(5000); // invalid -5 ignored
  });
});

describe('computeUsage', () => {
  it('computes percentage of cap used', () => {
    const l = loadHermesLimits(path.join(tmp, 'nope.json'));
    const usage = computeUsage(l, { memoryMd: 2500, userMd: 5000 });
    expect(usage[0]).toMatchObject({ label: 'MEMORY.md', usedChars: 2500, capChars: 5000, pct: 50 });
    expect(usage[1].pct).toBe(100);
  });
});

describe('planTrim', () => {
  const entries = parseMemoryMarkdown('alpha entry\n§\nbeta entry\n§\ngamma entry\n', 'MEMORY.md');

  it('plans only requested refs', () => {
    const plan = planTrim(entries, [{ file: 'MEMORY.md', index: 1 }]);
    expect([...plan.get('MEMORY.md')!]).toEqual([1]);
  });

  it('ignores refs that do not exist', () => {
    const plan = planTrim(entries, [{ file: 'MEMORY.md', index: 99 }]);
    expect(plan.get('MEMORY.md')?.size ?? 0).toBe(0);
  });

  it('never empties a file', () => {
    const plan = planTrim(entries, [0, 1, 2].map((index) => ({ file: 'MEMORY.md', index })));
    expect(plan.get('MEMORY.md')!.size).toBe(2);
  });
});

describe('entriesByCost', () => {
  it('sorts descending by token estimate', () => {
    const entries = parseMemoryMarkdown('short\n§\na much much longer entry with many more words in it\n', 'MEMORY.md');
    const sorted = entriesByCost(entries);
    expect(sorted[0].index).toBe(1);
    expect(entries[0].index).toBe(0); // input not mutated
  });
});
