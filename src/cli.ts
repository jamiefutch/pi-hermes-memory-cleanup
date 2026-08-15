import path from 'node:path';
import { analyzeHermesStorage, getHermesRoot, listHermesFiles } from './analyze.js';
import { parseHermesFiles, type MemoryEntry } from './parse.js';
import { findDuplicates } from './dupes.js';
import { findSuperseded } from './superseded.js';

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

export function main(): void {
  console.log(printStats());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
