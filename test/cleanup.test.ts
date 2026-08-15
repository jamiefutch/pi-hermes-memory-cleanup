import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRecoveryFilename, planRecoveryPrune, executePrune } from '../src/prune.js';
import { backupFiles } from '../src/backup.js';
import { rewriteWithoutEntries, planDedupe, parseEntryRef } from '../src/dedupe.js';
import { parseMemoryMarkdown } from '../src/parse.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-cleanup-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('parseRecoveryFilename', () => {
  it('parses valid recovery names', () => {
    const r = parseRecoveryFilename('.MEMORY.md.recovery-1786159192373-b792d013-a644-4561-830e-8434ac34d180');
    expect(r).toEqual({ baseFile: 'MEMORY.md', timestamp: 1786159192373 });
  });

  it('rejects non-recovery names', () => {
    expect(parseRecoveryFilename('MEMORY.md')).toBeNull();
    expect(parseRecoveryFilename('.MEMORY.md.recovery-notanumber-x')).toBeNull();
  });
});

function writeRecovery(base: string, ts: number, size = 10): string {
  const name = `.${base}.recovery-${ts}-b792d013-a644-4561-830e-8434ac34d180`;
  const p = path.join(tmp, name);
  fs.writeFileSync(p, 'x'.repeat(size));
  return p;
}

describe('planRecoveryPrune', () => {
  it('keeps newest N per base file', () => {
    writeRecovery('MEMORY.md', 100);
    writeRecovery('MEMORY.md', 300);
    writeRecovery('MEMORY.md', 200);
    writeRecovery('USER.md', 100);

    const plan = planRecoveryPrune(tmp, 1);
    expect(plan.totalCandidates).toBe(4);
    expect(plan.toDelete).toHaveLength(2); // MEMORY.md ts=100,200 and keeps USER.md
    expect(plan.toDelete.map((c) => c.timestamp).sort()).toEqual([100, 200]);
  });

  it('deletes nothing when count <= keep', () => {
    writeRecovery('MEMORY.md', 100);
    const plan = planRecoveryPrune(tmp, 5);
    expect(plan.toDelete).toHaveLength(0);
  });
});

describe('executePrune', () => {
  it('dry-run deletes nothing', () => {
    const p = writeRecovery('MEMORY.md', 100);
    writeRecovery('MEMORY.md', 200);
    const result = executePrune(planRecoveryPrune(tmp, 0), true);
    expect(result.dryRun).toBe(true);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('confirm deletes files and frees bytes', () => {
    writeRecovery('MEMORY.md', 100, 50);
    writeRecovery('MEMORY.md', 200, 50);
    const result = executePrune(planRecoveryPrune(tmp, 1), false);
    expect(result.deleted).toBe(1);
    expect(result.bytesFreed).toBe(50);
    expect(fs.readdirSync(tmp)).toHaveLength(1);
  });
});

describe('backupFiles', () => {
  it('copies files into a timestamped dir', () => {
    const p = path.join(tmp, 'MEMORY.md');
    fs.writeFileSync(p, 'content');
    const dir = backupFiles([p], path.join(tmp, 'backups'));
    expect(dir).not.toBeNull();
    expect(fs.readFileSync(path.join(dir!, 'MEMORY.md'), 'utf8')).toBe('content');
    expect(fs.existsSync(p)).toBe(true); // original untouched
  });

  it('returns null when nothing exists to copy', () => {
    expect(backupFiles([path.join(tmp, 'nope.md')], tmp)).toBeNull();
  });
});

describe('rewriteWithoutEntries', () => {
  const content = 'entry one\n§\nentry two\n§\nentry three\n';

  it('removes selected entries and keeps separator format', () => {
    const out = rewriteWithoutEntries(content, new Set([1]));
    expect(out).toBe('entry one\n§\nentry three\n');
  });

  it('removing all yields empty string', () => {
    expect(rewriteWithoutEntries(content, new Set([0, 1, 2]))).toBe('');
  });
});

describe('planDedupe', () => {
  it('keeps newest of an exact-dupe group, plans rest for removal', () => {
    const entries = parseMemoryMarkdown(
      'same content here for testing purposes <!-- created=2026-08-13 -->\n§\nsame content here for testing purposes <!-- created=2026-08-14 -->\n',
      'MEMORY.md',
    );
    const plan = planDedupe(entries);
    expect([...plan.get('MEMORY.md')!]).toEqual([0]); // removes older index 0, keeps 1
  });

  it('includes manual extraRefs', () => {
    const entries = parseMemoryMarkdown('one unique entry\n§\nanother unique entry\n', 'MEMORY.md');
    const plan = planDedupe(entries, [{ file: 'MEMORY.md', index: 0 }]);
    expect([...plan.get('MEMORY.md')!]).toEqual([0]);
  });

  it('never blanks a file', () => {
    const entries = parseMemoryMarkdown('only entry <!-- created=2026-08-13 -->\n', 'MEMORY.md');
    const plan = planDedupe(entries, [{ file: 'MEMORY.md', index: 0 }]);
    expect(plan.get('MEMORY.md')?.size ?? 0).toBe(0);
  });
});

describe('parseEntryRef', () => {
  it('matches by basename', () => {
    const ref = parseEntryRef('MEMORY.md#3', ['/root/MEMORY.md', '/root/USER.md']);
    expect(ref).toEqual({ file: '/root/MEMORY.md', index: 3 });
  });

  it('rejects malformed refs', () => {
    expect(parseEntryRef('garbage', ['/root/MEMORY.md'])).toBeNull();
    expect(parseEntryRef('NOPE.md#1', ['/root/MEMORY.md'])).toBeNull();
  });
});
