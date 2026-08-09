import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface HermesPathInfo {
  readonly root: string;
  readonly memoryMd: string;
  readonly userMd: string;
  readonly failuresMd: string;
  readonly memoryDb: string;
  readonly sessionsDb: string;
  readonly recoveryFiles: readonly string[];
  readonly retiredFiles: readonly string[];
}

export function getHermesRoot(): string {
  return path.join(os.homedir(), '.pi', 'agent', 'pi-hermes-memory');
}

export function listHermesFiles(root = getHermesRoot()): HermesPathInfo {
  if (!fs.existsSync(root)) {
    return {
      root,
      memoryMd: path.join(root, 'MEMORY.md'),
      userMd: path.join(root, 'USER.md'),
      failuresMd: path.join(root, 'failures.md'),
      memoryDb: path.join(root, 'memory.db'),
      sessionsDb: path.join(root, 'sessions.db'),
      recoveryFiles: [],
      retiredFiles: [],
    };
  }

  const entries = fs.readdirSync(root);

  return {
    root,
    memoryMd: path.join(root, 'MEMORY.md'),
    userMd: path.join(root, 'USER.md'),
    failuresMd: path.join(root, 'failures.md'),
    memoryDb: path.join(root, 'memory.db'),
    sessionsDb: path.join(root, 'sessions.db'),
    recoveryFiles: entries
      .filter((f) => f.includes('recovery'))
      .map((f) => path.join(root, f)),
    retiredFiles: entries
      .filter((f) => f.includes('retired'))
      .map((f) => path.join(root, f)),
  };
}

export function fileSizeBytes(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function totalSizeBytes(paths: readonly string[]): number {
  return paths.reduce((sum, p) => sum + fileSizeBytes(p), 0);
}

export interface MemoryStats {
  readonly activeFiles: {
    memoryMd: number;
    userMd: number;
    failuresMd: number;
  };
  readonly recoveryFiles: {
    count: number;
    bytes: number;
  };
  readonly retiredFiles: {
    count: number;
    bytes: number;
  };
  readonly databases: {
    memoryDb: number;
    sessionsDb: number;
  };
}

export function analyzeHermesStorage(root = getHermesRoot()): MemoryStats {
  const files = listHermesFiles(root);

  return {
    activeFiles: {
      memoryMd: fileSizeBytes(files.memoryMd),
      userMd: fileSizeBytes(files.userMd),
      failuresMd: fileSizeBytes(files.failuresMd),
    },
    recoveryFiles: {
      count: files.recoveryFiles.length,
      bytes: totalSizeBytes(files.recoveryFiles),
    },
    retiredFiles: {
      count: files.retiredFiles.length,
      bytes: totalSizeBytes(files.retiredFiles),
    },
    databases: {
      memoryDb: fileSizeBytes(files.memoryDb),
      sessionsDb: fileSizeBytes(files.sessionsDb),
    },
  };
}
