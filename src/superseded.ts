import type { MemoryEntry } from './parse.js';
import { normalizeText, overlap } from './dupes.js';

export interface SupersededPair {
  /** The older entry whose content is largely contained in `supersededBy`. */
  readonly entry: MemoryEntry;
  /** The newer entry that contains most of `entry`'s content. */
  readonly supersededBy: MemoryEntry;
  /** Overlap coefficient |A∩B| / min(|A|,|B|). */
  readonly overlap: number;
}

function tokenSetOf(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((t) => t.length > 2),
  );
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/**
 * Detect entries superseded by newer entries: the newer entry was created
 * strictly after the older one AND contains at least `overlapThreshold` of
 * the older entry's tokens (with >= 5 shared tokens to avoid short-entry noise).
 * The newer entry must also add something (more tokens), otherwise equal-size
 * high-overlap pairs are just duplicates.
 */
export function findSuperseded(
  entries: readonly MemoryEntry[],
  overlapThreshold = 0.7,
): SupersededPair[] {
  const sets = entries.map((e) => tokenSetOf(e.text));
  const results: SupersededPair[] = [];

  for (let i = 0; i < entries.length; i++) {
    const older = entries[i];
    if (!older.created) continue;

    let best: SupersededPair | null = null;
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const newer = entries[j];
      if (!newer.created) continue;
      if (daysBetween(newer.created, older.created) <= 0) continue;
      // Newer entry must add content, not just restate
      if (sets[j].size <= sets[i].size) continue;

      const ov = overlap(sets[i], sets[j]);
      if (ov < overlapThreshold) continue;

      let shared = 0;
      for (const t of sets[i]) {
        if (sets[j].has(t)) shared++;
      }
      if (shared < 5) continue;

      if (!best || ov > best.overlap) {
        best = { entry: older, supersededBy: newer, overlap: ov };
      }
    }
    if (best) results.push(best);
  }

  results.sort((a, b) => b.overlap - a.overlap);
  return results;
}
