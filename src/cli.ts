import { analyzeHermesStorage, getHermesRoot } from './analyze.js';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

export function printStats(): string {
  const root = getHermesRoot();
  const stats = analyzeHermesStorage(root);

  const lines: string[] = [];
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
  lines.push('');
  const backupTotal = stats.recoveryFiles.bytes + stats.retiredFiles.bytes;
  lines.push(`Backup total: ${formatBytes(backupTotal)}`);

  return lines.join('\n');
}

export function main(): void {
  console.log(printStats());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
