import fs from 'node:fs';
import path from 'node:path';

export interface PruneCandidate {
  readonly file: string;
  readonly baseFile: string;
  readonly timestamp: number;
  readonly bytes: number;
}

export interface PrunePlan {
  readonly keep: number;
  readonly toDelete: readonly PruneCandidate[];
  readonly bytesFreed: number;
  readonly totalCandidates: number;
}

const RECOVERY_RE = /^\.(.+)\.recovery-(\d+)-[0-9a-f-]+$/i;

/** Parse a recovery filename like `.MEMORY.md.recovery-1786159192373-<uuid>`. */
export function parseRecoveryFilename(name: string): { baseFile: string; timestamp: number } | null {
  const m = path.basename(name).match(RECOVERY_RE);
  if (!m) return null;
  return { baseFile: m[1], timestamp: Number(m[2]) };
}

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/**
 * Plan pruning of recovery files: per base file, keep the newest `keep`
 * candidates and mark the rest for deletion. Pure — no side effects.
 */
export function planRecoveryPrune(root: string, keep: number): PrunePlan {
  let names: string[] = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return { keep, toDelete: [], bytesFreed: 0, totalCandidates: 0 };
  }

  const candidates: PruneCandidate[] = [];
  for (const name of names) {
    const parsed = parseRecoveryFilename(name);
    if (!parsed) continue;
    const file = path.join(root, name);
    candidates.push({ file, baseFile: parsed.baseFile, timestamp: parsed.timestamp, bytes: fileSize(file) });
  }

  const byBase = new Map<string, PruneCandidate[]>();
  for (const c of candidates) {
    const group = byBase.get(c.baseFile);
    if (group) group.push(c);
    else byBase.set(c.baseFile, [c]);
  }

  const toDelete: PruneCandidate[] = [];
  for (const group of byBase.values()) {
    group.sort((a, b) => b.timestamp - a.timestamp); // newest first
    toDelete.push(...group.slice(Math.max(0, keep)));
  }
  toDelete.sort((a, b) => a.file.localeCompare(b.file));

  return {
    keep,
    toDelete,
    bytesFreed: toDelete.reduce((s, c) => s + c.bytes, 0),
    totalCandidates: candidates.length,
  };
}

export interface PruneResult {
  readonly deleted: number;
  readonly bytesFreed: number;
  readonly dryRun: boolean;
}

/** Execute a prune plan. When dryRun, only reports — deletes nothing. */
export function executePrune(plan: PrunePlan, dryRun: boolean): PruneResult {
  if (dryRun) {
    return { deleted: 0, bytesFreed: plan.bytesFreed, dryRun: true };
  }
  let deleted = 0;
  for (const c of plan.toDelete) {
    try {
      fs.rmSync(c.file);
      deleted++;
    } catch {
      // leave file in place; reported via deleted count mismatch
    }
  }
  return { deleted, bytesFreed: plan.toDelete.filter((c) => !fs.existsSync(c.file)).reduce((s, c) => s + c.bytes, 0), dryRun: false };
}
