import fs from 'node:fs';
import path from 'node:path';

/**
 * Copy files into `<backupRoot>/<ISO timestamp>/` before mutation.
 * Returns the backup directory path, or null if nothing was copied.
 */
export function backupFiles(paths: readonly string[], backupRoot: string): string | null {
  const existing = paths.filter((p) => fs.existsSync(p));
  if (existing.length === 0) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(backupRoot, stamp);
  fs.mkdirSync(dir, { recursive: true });

  for (const p of existing) {
    fs.copyFileSync(p, path.join(dir, path.basename(p)));
  }
  return dir;
}

/** Default backup location: alongside the Hermes files, clearly namespaced. */
export function defaultBackupRoot(hermesRoot: string): string {
  return path.join(hermesRoot, '.cleanup-backups');
}
