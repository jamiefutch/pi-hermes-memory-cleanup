import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { measureInjection } from '../src/inject.js';
import { loadHermesLimits } from '../src/limits.js';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-inject-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function limitsWith(overrides: Record<string, unknown>): ReturnType<typeof loadHermesLimits> {
  const p = path.join(tmp, 'cfg.json');
  fs.writeFileSync(p, JSON.stringify(overrides));
  return loadHermesLimits(p);
}

const sizes = { memoryMd: 2000, userMd: 2000, failuresMd: 1000 };

describe('measureInjection', () => {
  it('policy-only + style none: zero tokens, files not injected', () => {
    const limits = limitsWith({ memoryMode: 'policy-only', memoryPolicyStyle: 'none' });
    const inj = measureInjection(tmp, limits, sizes);
    expect(inj.totalTokens).toBe(0);
    expect(inj.fileTokens).toBe(0);
    expect(inj.filesNote).toMatch(/not injected/);
  });

  it('policy-only + full: policy prompt only (~945 tokens)', () => {
    const limits = limitsWith({ memoryMode: 'policy-only', memoryPolicyStyle: 'full' });
    const inj = measureInjection(tmp, limits, sizes);
    expect(inj.policyPromptTokens).toBe(Math.ceil(3780 / 4));
    expect(inj.totalTokens).toBe(inj.policyPromptTokens);
  });

  it('legacy-inject: file contents are counted', () => {
    const limits = limitsWith({ memoryMode: 'legacy-inject' });
    const inj = measureInjection(tmp, limits, sizes);
    expect(inj.fileTokens).toBe(Math.ceil(5000 / 4));
    expect(inj.totalTokens).toBe(inj.fileTokens);
    expect(inj.filesNote).toMatch(/injected every request/);
  });

  it('counts standing instructions when STANDING.md exists', () => {
    fs.writeFileSync(path.join(tmp, 'STANDING.md'), 'x'.repeat(400));
    const limits = limitsWith({ memoryMode: 'policy-only', memoryPolicyStyle: 'none' });
    const inj = measureInjection(tmp, limits, sizes);
    expect(inj.standingTokens).toBe(100);
    expect(inj.totalTokens).toBe(100);
  });

  it('custom policy style uses the custom text length', () => {
    const limits = limitsWith({ memoryMode: 'policy-only', memoryPolicyStyle: 'custom', memoryPolicyCustomText: 'y'.repeat(800) });
    const inj = measureInjection(tmp, limits, sizes);
    expect(inj.policyPromptTokens).toBe(200);
  });
});
