import path from 'node:path';
import { analyzeHermesStorage, getHermesRoot, listHermesFiles } from './analyze.js';
import { parseHermesFiles, type MemoryEntry } from './parse.js';
import { findDuplicates } from './dupes.js';
import { findSuperseded } from './superseded.js';
import { planRecoveryPrune, executePrune } from './prune.js';
import { planDedupe, executeDedupe, parseEntryRef, type EntryRef } from './dedupe.js';
import { loadHermesLimits, computeUsage, hermesConfigPath } from './limits.js';
import { planTrim, entriesByCost } from './trim.js';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function shortName(file: string): string {
  return path.basename(file);
}

function preview(text: string, max = 70): string {
  const oneLine = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function formatDate(iso: string | null): string {
  return iso ?? 'unknown';
}

function printStorageSection(lines: string[]): void {
  const root = getHermesRoot();
  const stats = analyzeHermesStorage(root);
  lines.push(`Hermes storage: ${root}`);
  lines.push('');
  lines.push('Active markdown files:');
  lines.push(`  MEMORY.md  : ${formatBytes(stats.activeFiles.memoryMd)}`);
  lines.push(`  USER.md    : ${formatBytes(stats.activeFiles.userMd)}`);
  lines.push(`  failures.md: ${formatBytes(stats.activeFiles.failuresMd)}`);
  lines.push('');
  lines.push('Backup files:');
  lines.push(`  Recovery files: ${stats.recoveryFiles.count} (${formatBytes(stats.recoveryFiles.bytes)})`);
  lines.push(`  Retired files : ${stats.retiredFiles.count} (${formatBytes(stats.retiredFiles.bytes)})`);
  lines.push('');
  lines.push('Databases:');
  lines.push(`  memory.db  : ${formatBytes(stats.databases.memoryDb)}`);
  lines.push(`  sessions.db: ${formatBytes(stats.databases.sessionsDb)}`);
}

function printEntriesSection(lines: string[], root: string): MemoryEntry[] {
  const files = listHermesFiles(root);
  const markdownFiles = [files.memoryMd, files.userMd, files.failuresMd];
  const { entries, perFile } = parseHermesFiles(markdownFiles);

  lines.push('');
  lines.push('Memory entries:');
  if (entries.length === 0) {
    lines.push('  (none found)');
    return [];
  }

  let totalTokens = 0;
  for (const [file, info] of Object.entries(perFile)) {
    lines.push(
      `  ${shortName(file)}: ${info.count} entries, ${formatBytes(info.bytes)}, ~${info.estTokens.toLocaleString()} tokens`,
    );
    totalTokens += info.estTokens;
  }
  lines.push(`  Total injected context: ~${totalTokens.toLocaleString()} tokens`);
  lines.push('');

  const stale = [...entries]
    .filter((e) => e.last !== null)
    .sort((a, b) => (a.last! < b.last! ? -1 : 1))
    .slice(0, 5);
  if (stale.length > 0) {
    lines.push('Stalest entries (by last activity):');
    for (const e of stale) {
      lines.push(`  [${shortName(e.file)}#${e.index}] last=${formatDate(e.last)} — ${preview(e.text)}`);
    }
  }

  lines.push('');
  lines.push('Largest entries (by est. tokens):');
  for (const e of entriesByCost(entries).slice(0, 5)) {
    lines.push(`  ~${String(e.estTokens).padStart(4)} tok  ${shortName(e.file)}#${e.index} — ${preview(e.text, 60)}`);
  }
  return [...entries];
}

function printDuplicatesSection(lines: string[], entries: readonly MemoryEntry[]): void {
  const dupes = findDuplicates(entries);
  lines.push('');
  lines.push('Duplicates:');
  if (dupes.exact.length === 0 && dupes.near.length === 0) {
    lines.push('  (none found)');
    return;
  }

  for (const group of dupes.exact) {
    const refs = group.map((e) => `${shortName(e.file)}#${e.index}`).join(' = ');
    lines.push(`  EXACT  ${refs}`);
    lines.push(`         ${preview(group[0].text)}`);
  }
  for (const pair of dupes.near) {
    const pct = Math.round(pair.similarity * 100);
    lines.push(
      `  ~${pct}%   ${shortName(pair.a.file)}#${pair.a.index} ≈ ${shortName(pair.b.file)}#${pair.b.index}`,
    );
    lines.push(`         A: ${preview(pair.a.text)}`);
    lines.push(`         B: ${preview(pair.b.text)}`);
  }
}

function printSupersededSection(lines: string[], entries: readonly MemoryEntry[]): void {
  const superseded = findSuperseded(entries);
  lines.push('');
  lines.push('Superseded entries (newer entry contains this content):');
  if (superseded.length === 0) {
    lines.push('  (none found)');
    return;
  }
  for (const s of superseded) {
    const pct = Math.round(s.overlap * 100);
    lines.push(
      `  ~${pct}%   ${shortName(s.entry.file)}#${s.entry.index} → superseded by ${shortName(s.supersededBy.file)}#${s.supersededBy.index}`,
    );
    lines.push(`         old (created=${formatDate(s.entry.created)}): ${preview(s.entry.text)}`);
    lines.push(`         new (created=${formatDate(s.supersededBy.created)}): ${preview(s.supersededBy.text)}`);
  }
}

export function printStats(): string {
  const lines: string[] = [];
  printStorageSection(lines);
  const entries = printEntriesSection(lines, getHermesRoot());
  printDuplicatesSection(lines, entries);
  printSupersededSection(lines, entries);
  return lines.join('\n');
}

export interface CliArgs {
  readonly command: string;
  readonly confirm: boolean;
  readonly keep: number;
  readonly remove: readonly string[];
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('-') ? (args.shift() as string) : 'report';
  let keep = 10;
  const remove: string[] = [];
  let confirm = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--confirm') confirm = true;
    else if (a === '--keep') keep = Number(args[++i] ?? keep);
    else if (a === '--remove') remove.push(args[++i] ?? '');
  }
  return { command, confirm, keep: Number.isFinite(keep) && keep >= 0 ? keep : 10, remove };
}

export function runPrune(args: CliArgs): string {
  const root = getHermesRoot();
  const plan = planRecoveryPrune(root, args.keep);
  const lines: string[] = [];
  lines.push(`Recovery prune: ${plan.totalCandidates} recovery files, keeping newest ${plan.keep} per file`);
  lines.push(`Would delete: ${plan.toDelete.length} files (${formatBytes(plan.bytesFreed)})`);

  if (!args.confirm) {
    lines.push('');
    lines.push('DRY RUN — re-run with --confirm to delete.');
    for (const c of plan.toDelete.slice(0, 10)) lines.push(`  ${path.basename(c.file)}`);
    if (plan.toDelete.length > 10) lines.push(`  …and ${plan.toDelete.length - 10} more`);
    return lines.join('\n');
  }

  const result = executePrune(plan, false);
  lines.push(`DELETED ${result.deleted} files, freed ${formatBytes(result.bytesFreed)}`);
  return lines.join('\n');
}

export function runDedupe(args: CliArgs): string {
  const root = getHermesRoot();
  const files = listHermesFiles(root);
  const markdownFiles = [files.memoryMd, files.userMd, files.failuresMd];
  const { entries } = parseHermesFiles(markdownFiles);

  const extraRefs: EntryRef[] = [];
  for (const ref of args.remove) {
    const parsed = parseEntryRef(ref, markdownFiles);
    if (!parsed) return `Invalid --remove ref: ${ref} (expected e.g. MEMORY.md#3)`;
    extraRefs.push(parsed);
  }

  const plan = planDedupe(entries, extraRefs);
  const lines: string[] = [];
  let total = 0;
  for (const [file, indices] of plan) {
    const list = [...indices].sort((a, b) => a - b);
    total += list.length;
    lines.push(`${path.basename(file)}: remove entries ${list.map((i) => `#${i}`).join(', ')}`);
  }
  if (total === 0) lines.push('Nothing to remove.');

  if (!args.confirm) {
    lines.push('');
    lines.push('DRY RUN — re-run with --confirm to apply (a backup is taken first).');
    return lines.join('\n');
  }

  const result = executeDedupe(plan, root, false);
  lines.push(`Backup: ${result.backupDir ?? '(none)'}`);
  lines.push(`REMOVED ${result.entriesRemoved} entries from ${result.filesChanged.length} files, saved ${formatBytes(result.bytesSaved)}`);
  return lines.join('\n');
}

export function runLimits(): string {
  const root = getHermesRoot();
  const stats = analyzeHermesStorage(root);
  const limits = loadHermesLimits();
  const usage = computeUsage(limits, {
    memoryMd: stats.activeFiles.memoryMd,
    userMd: stats.activeFiles.userMd,
  });

  const lines: string[] = [];
  lines.push(`Hermes config: ${hermesConfigPath()}`);
  lines.push(`  memoryMode:            ${limits.memoryMode}`);
  lines.push(`  memoryPolicyStyle:     ${limits.memoryPolicyStyle}`);
  lines.push('');
  lines.push('Injection caps vs actual usage:');
  for (const u of usage) {
    const warn = u.pct >= 90 ? '  ⚠️ near cap' : '';
    lines.push(`  ${u.label.padEnd(10)} ${formatBytes(u.usedChars)} / ${formatBytes(u.capChars)} (${u.pct}%)${warn}`);
  }
  lines.push('');
  lines.push('failures.md injection filter:');
  lines.push(`  max age:     ${limits.failureInjectionMaxAgeDays} days`);
  lines.push(`  max entries: ${limits.failureInjectionMaxEntries}`);
  lines.push('');
  lines.push('Edit the config file to tune; defaults are 5000 chars per file.');
  return lines.join('\n');
}

export function runTrim(args: CliArgs): string {
  const root = getHermesRoot();
  const files = listHermesFiles(root);
  const markdownFiles = [files.memoryMd, files.userMd, files.failuresMd];
  const { entries } = parseHermesFiles(markdownFiles);

  const refs: EntryRef[] = [];
  for (const ref of args.remove) {
    const parsed = parseEntryRef(ref, markdownFiles);
    if (!parsed) return `Invalid --remove ref: ${ref} (expected e.g. MEMORY.md#3)`;
    refs.push(parsed);
  }
  if (refs.length === 0) {
    const lines = ['Trim: pick entries to remove by ref. Largest entries:', ''];
    for (const e of entriesByCost(entries).slice(0, 10)) {
      lines.push(`  ~${String(e.estTokens).padStart(4)} tok  ${shortName(e.file)}#${e.index} — ${preview(e.text, 60)}`);
    }
    lines.push('');
    lines.push('Usage: trim --confirm --remove MEMORY.md#3 [--remove USER.md#1 ...]');
    return lines.join('\n');
  }

  const plan = planTrim(entries, refs);
  const lines: string[] = [];
  let total = 0;
  for (const [file, indices] of plan) {
    const list = [...indices].sort((a, b) => a - b);
    total += list.length;
    lines.push(`${path.basename(file)}: remove entries ${list.map((i) => `#${i}`).join(', ')}`);
  }
  if (total === 0) lines.push('Nothing to remove (refs invalid or would empty a file).');

  if (!args.confirm) {
    lines.push('');
    lines.push('DRY RUN — re-run with --confirm to apply (a backup is taken first).');
    return lines.join('\n');
  }

  const result = executeDedupe(plan, root, false);
  lines.push(`Backup: ${result.backupDir ?? '(none)'}`);
  lines.push(`REMOVED ${result.entriesRemoved} entries from ${result.filesChanged.length} files, saved ${formatBytes(result.bytesSaved)}`);
  return lines.join('\n');
}

const USAGE = `Usage:
  report                      Storage + entry + duplicate report (default)
  limits                      Configured injection caps vs actual usage
  trim --confirm --remove FILE#IDX ...
                              Remove specific entries (largest-first picker list)
  prune [--keep N] [--confirm]   Delete old recovery files (keeps newest N=10 per file)
  dedupe [--confirm] [--remove FILE#IDX ...]
                              Remove exact-dupe extras + superseded entries

All mutating commands are DRY RUN unless --confirm is passed.`;

export function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'report') console.log(printStats());
  else if (args.command === 'limits') console.log(runLimits());
  else if (args.command === 'trim') console.log(runTrim(args));
  else if (args.command === 'prune') console.log(runPrune(args));
  else if (args.command === 'dedupe') console.log(runDedupe(args));
  else console.log(USAGE);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
