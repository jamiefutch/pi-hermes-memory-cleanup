import { createHash } from 'node:crypto';
import type { MemoryEntry } from './parse.js';

/** Normalize entry text for comparison: strip HTML-comment metadata, lowercase, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function contentHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/** Token multiset for Jaccard similarity. */
function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((t) => t.length > 2));
}

/** Jaccard similarity over word sets: |A∩B| / |A∪B|. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/** Overlap (containment) coefficient: |A∩B| / min(|A|,|B|). Catches "entry B = entry A + more detail". */
export function overlap(a: Set<string>, b: Set<string>): number {
  const min = Math.min(a.size, b.size);
  if (min === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  return intersection / min;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) n++;
  }
  return n;
}

export interface DuplicatePair {
  readonly a: MemoryEntry;
  readonly b: MemoryEntry;
  readonly similarity: number;
  readonly exact: boolean;
}

export interface DuplicateReport {
  readonly exact: readonly MemoryEntry[][];
  readonly near: readonly DuplicatePair[];
}

/**
 * Detect exact duplicates (identical normalized text) and near-duplicates
 * (Jaccard/overlap similarity >= threshold with >= 5 shared tokens).
 * O(n²) — fine for memory files with dozens-to-hundreds of entries.
 */
export function findDuplicates(
  entries: readonly MemoryEntry[],
  nearThreshold = 0.6,
): DuplicateReport {
  const byHash = new Map<string, number[]>();
  const norm = entries.map((e) => normalizeText(e.text));
  const sets = norm.map((n) => tokenSet(n));

  entries.forEach((_, i) => {
    const h = contentHash(norm[i]);
    const group = byHash.get(h);
    if (group) group.push(i);
    else byHash.set(h, [i]);
  });

  const exactGroups = [...byHash.values()].filter((g) => g.length > 1);
  const exact = exactGroups.map((g) => g.map((i) => entries[i]));
  const exactPairs = new Set<string>();
  for (const g of exactGroups) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        exactPairs.add(`${g[i]}:${g[j]}`);
      }
    }
  }

  const near: DuplicatePair[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      // Skip pairs already reported as an exact group
      if (exactPairs.has(`${i}:${j}`)) continue;
      // Flag when entries are broadly similar (jaccard) or one largely
      // contains the other (overlap) — the memory-supersession pattern.
      // Require >= 5 shared tokens to avoid noise from short entries.
      const sim = Math.max(jaccard(sets[i], sets[j]), overlap(sets[i], sets[j]));
      if (sim >= nearThreshold && intersectionSize(sets[i], sets[j]) >= 5) {
        near.push({ a: entries[i], b: entries[j], similarity: sim, exact: false });
      }
    }
  }

  near.sort((x, y) => y.similarity - x.similarity);
  return { exact, near };
}
