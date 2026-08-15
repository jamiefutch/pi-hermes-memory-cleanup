import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Subset of pi-hermes-memory's MemoryConfig relevant to context size. */
export interface HermesLimits {
  readonly memoryMode: string;
  readonly memoryPolicyStyle: string;
  readonly memoryPolicyCustomText?: string;
  readonly memoryCharLimit: number;
  readonly userCharLimit: number;
  readonly projectCharLimit: number;
  readonly failureInjectionMaxAgeDays: number;
  readonly failureInjectionMaxEntries: number;
}

const DEFAULTS: HermesLimits = {
  memoryMode: 'policy-only',
  memoryPolicyStyle: 'full',
  memoryCharLimit: 5000,
  userCharLimit: 5000,
  projectCharLimit: 5000,
  failureInjectionMaxAgeDays: 7,
  failureInjectionMaxEntries: 5,
};

export function hermesConfigPath(): string {
  return path.join(os.homedir(), '.pi', 'agent', 'hermes-memory-config.json');
}

/** Load Hermes limits: defaults merged with ~/.pi/agent/hermes-memory-config.json. */
export function loadHermesLimits(configPath = hermesConfigPath()): HermesLimits {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const num = (v: unknown, d: number) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d;
    const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
    return {
      memoryMode: str(parsed.memoryMode, DEFAULTS.memoryMode),
      memoryPolicyStyle: str(parsed.memoryPolicyStyle, DEFAULTS.memoryPolicyStyle),
      memoryPolicyCustomText: typeof parsed.memoryPolicyCustomText === 'string' ? parsed.memoryPolicyCustomText : undefined,
      memoryCharLimit: num(parsed.memoryCharLimit, DEFAULTS.memoryCharLimit),
      userCharLimit: num(parsed.userCharLimit, DEFAULTS.userCharLimit),
      projectCharLimit: num(parsed.projectCharLimit, DEFAULTS.projectCharLimit),
      failureInjectionMaxAgeDays: num(parsed.failureInjectionMaxAgeDays, DEFAULTS.failureInjectionMaxAgeDays),
      failureInjectionMaxEntries: num(parsed.failureInjectionMaxEntries, DEFAULTS.failureInjectionMaxEntries),
    };
  } catch {
    return DEFAULTS;
  }
}

export interface LimitUsage {
  readonly label: string;
  readonly file: string;
  readonly usedChars: number;
  readonly capChars: number;
  readonly pct: number;
}

/** Actual usage vs configured caps. Only MEMORY.md and USER.md have char caps;
 *  failures.md is governed by injection-time age/entry filters instead. */
export function computeUsage(
  limits: HermesLimits,
  sizes: { memoryMd: number; userMd: number },
): LimitUsage[] {
  const rows: Array<[string, number, number]> = [
    ['MEMORY.md', sizes.memoryMd, limits.memoryCharLimit],
    ['USER.md', sizes.userMd, limits.userCharLimit],
  ];
  return rows.map(([label, used, cap]) => ({
    label,
    file: label,
    usedChars: used,
    capChars: cap,
    pct: cap > 0 ? Math.round((used / cap) * 100) : 0,
  }));
}
