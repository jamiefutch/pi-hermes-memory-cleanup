import type { MemoryEntry } from './parse.js';
import type { EntryRef } from './dedupe.js';

/**
 * Build a removal plan from explicit entry picks (no auto-detection).
 * Guards: refs must exist; a file is never emptied entirely (keeps the
 * highest-index remaining entry). Pure.
 */
export function planTrim(
  entries: readonly MemoryEntry[],
  refs: readonly EntryRef[],
): Map<string, Set<number>> {
  const plan = new Map<string, Set<number>>();
  const valid = new Set(entries.map((e) => `${e.file}#${e.index}`));

  for (const ref of refs) {
    if (!valid.has(`${ref.file}#${ref.index}`)) continue;
    const set = plan.get(ref.file) ?? new Set<number>();
    set.add(ref.index);
    plan.set(ref.file, set);
  }

  for (const [file, set] of plan) {
    const total = entries.filter((e) => e.file === file).length;
    if (set.size >= total) {
      const sorted = [...set].sort((a, b) => a - b);
      set.delete(sorted[sorted.length - 1]);
    }
  }

  return plan;
}

/** Format entries for a picker/report: sorted by token cost, descending. */
export function entriesByCost(entries: readonly MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => b.estTokens - a.estTokens);
}
