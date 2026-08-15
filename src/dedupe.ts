import fs from 'node:fs';
import { findDuplicates } from './dupes.js';
import { findSuperseded } from './superseded.js';
import { backupFiles, defaultBackupRoot } from './backup.js';
import type { MemoryEntry } from './parse.js';

export interface EntryRef {
  readonly file: string;
  readonly index: number;
}

/** Rebuild markdown content without the given entry indices. Pure. */
export function rewriteWithoutEntries(content: string, removeIndices: ReadonlySet<number>): string {
  const chunks = content
    .split(/^\s*§\s*$/m)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const kept = chunks.filter((_, i) => !removeIndices.has(i));
  return kept.length === 0 ? '' : `${kept.join('\n§\n')}\n`;
}

/**
 * Auto plan: remove all but the newest member of each exact-duplicate group,
 * plus every superseded entry. Near-duplicates are NOT auto-planned — they
 * require an explicit manual choice via extraRefs. Pure.
 */
export function planDedupe(
  entries: readonly MemoryEntry[],
  extraRefs: readonly EntryRef[] = [],
): Map<string, Set<number>> {
  const plan = new Map<string, Set<number>>();
  const add = (file: string, index: number) => {
    const set = plan.get(file) ?? new Set<number>();
    set.add(index);
    plan.set(file, set);
  };

  const dupes = findDuplicates(entries);
  for (const group of dupes.exact) {
    // Keep the newest by created date (fall back to highest index)
    const sorted = [...group].sort((a, b) => {
      const dc = (b.created ?? '').localeCompare(a.created ?? '');
      return dc !== 0 ? dc : b.index - a.index;
    });
    for (const e of sorted.slice(1)) add(e.file, e.index);
  }

  for (const s of findSuperseded(entries)) {
    add(s.entry.file, s.entry.index);
  }

  for (const ref of extraRefs) add(ref.file, ref.index);

  // Never empty a file entirely
  for (const [file, set] of plan) {
    const total = entries.filter((e) => e.file === file).length;
    if (set.size >= total) {
      // Keep the highest-index entry so the file is not blanked
      const sorted = [...set].sort((a, b) => a - b);
      set.delete(sorted[sorted.length - 1]);
    }
  }

  return plan;
}

export interface DedupeResult {
  readonly dryRun: boolean;
  readonly backupDir: string | null;
  readonly filesChanged: readonly string[];
  readonly entriesRemoved: number;
  readonly bytesSaved: number;
}

/** Execute a dedupe plan. Dry-run only reports; otherwise backs up then rewrites. */
export function executeDedupe(
  plan: Map<string, Set<number>>,
  hermesRoot: string,
  dryRun: boolean,
): DedupeResult {
  const filesChanged = [...plan.keys()].filter((f) => (plan.get(f)?.size ?? 0) > 0);
  const entriesRemoved = [...plan.values()].reduce((s, set) => s + set.size, 0);

  if (dryRun || filesChanged.length === 0) {
    return { dryRun: true, backupDir: null, filesChanged, entriesRemoved, bytesSaved: 0 };
  }

  const backupDir = backupFiles(filesChanged, defaultBackupRoot(hermesRoot));
  let bytesSaved = 0;

  for (const file of filesChanged) {
    const before = fs.readFileSync(file, 'utf8');
    const after = rewriteWithoutEntries(before, plan.get(file)!);
    fs.writeFileSync(file, after);
    bytesSaved += Buffer.byteLength(before, 'utf8') - Buffer.byteLength(after, 'utf8');
  }

  return { dryRun: false, backupDir, filesChanged, entriesRemoved, bytesSaved };
}

/** Convenience: parse a "file#index" CLI ref. Returns null when malformed. */
export function parseEntryRef(ref: string, knownFiles: readonly string[]): EntryRef | null {
  const m = ref.match(/^(.+)#(\d+)$/);
  if (!m) return null;
  const match = knownFiles.find((f) => f === m[1] || f.endsWith(`/${m[1]}`));
  return match ? { file: match, index: Number(m[2]) } : null;
}
