import fs from 'node:fs';
import path from 'node:path';
import type { HermesLimits } from './limits.js';

function charsToTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Policy prompt sizes measured from pi-hermes-memory constants.ts (2026-08). */
const POLICY_PROMPT_CHARS: Record<string, number> = {
  full: 3780,
  compact: 1792,
  none: 0,
};

export interface InjectionBreakdown {
  readonly mode: string;
  readonly policyStyle: string;
  readonly policyPromptTokens: number;
  readonly standingTokens: number;
  /** legacy-inject only: tokens from MEMORY.md + USER.md + recent failures */
  readonly fileTokens: number;
  readonly totalTokens: number;
  /** Human-readable note on what the markdown files cost in this mode. */
  readonly filesNote: string;
}

function readChars(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function policyPromptChars(limits: HermesLimits): number {
  if (limits.memoryPolicyStyle === 'custom') {
    // Custom prompt text lives in the config file; fall back to compact size.
    return limits.memoryPolicyCustomText?.length ?? POLICY_PROMPT_CHARS.compact;
  }
  return POLICY_PROMPT_CHARS[limits.memoryPolicyStyle] ?? POLICY_PROMPT_CHARS.full;
}

/**
 * Compute what Hermes actually injects into every request, given the mode:
 * - policy-only: policy prompt + standing instructions (markdown files are
 *   tool-searchable only — zero per-request cost)
 * - legacy-inject: full file contents + standing instructions
 */
export function measureInjection(
  hermesRoot: string,
  limits: HermesLimits,
  fileSizes: { memoryMd: number; userMd: number; failuresMd: number },
): InjectionBreakdown {
  const standingChars = readChars(path.join(hermesRoot, 'STANDING.md'));
  const standingTokens = charsToTokens(standingChars);
  const policyTokens = charsToTokens(policyPromptChars(limits));

  if (limits.memoryMode === 'policy-only') {
    return {
      mode: limits.memoryMode,
      policyStyle: limits.memoryPolicyStyle,
      policyPromptTokens: policyTokens,
      standingTokens,
      fileTokens: 0,
      totalTokens: policyTokens + standingTokens,
      filesNote: 'markdown files not injected (tool-searchable only)',
    };
  }

  const fileTokens =
    charsToTokens(fileSizes.memoryMd) +
    charsToTokens(fileSizes.userMd) +
    charsToTokens(fileSizes.failuresMd);
  return {
    mode: limits.memoryMode,
    policyStyle: limits.memoryPolicyStyle,
    policyPromptTokens: 0,
    standingTokens,
    fileTokens,
    totalTokens: fileTokens + standingTokens,
    filesNote: 'full file contents injected every request',
  };
}
