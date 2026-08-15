import fs from 'node:fs';

export interface MemoryEntry {
  readonly file: string;
  readonly index: number;
  readonly text: string;
  readonly created: string | null;
  readonly last: string | null;
  readonly bytes: number;
  readonly estTokens: number;
}

const SEPARATOR = '§';
const META_RE = /<!--\s*created=([^\s,]+)(?:,\s*last=([^\s]+?))?\s*-->/;

/** Rough token estimate: ~4 chars per token for English prose. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function parseMeta(text: string): { created: string | null; last: string | null } {
  const m = text.match(META_RE);
  return { created: m?.[1] ?? null, last: m?.[2] ?? null };
}

/** Parse a Hermes markdown memory file into entries split on `§` lines. */
export function parseMemoryMarkdown(content: string, file: string): MemoryEntry[] {
  return content
    .split(/^\s*§\s*$/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((text, index) => {
      const { created, last } = parseMeta(text);
      return {
        file,
        index,
        text,
        created,
        last,
        bytes: Buffer.byteLength(text, 'utf8'),
        estTokens: estimateTokens(text),
      };
    });
}

export function parseMemoryFile(filePath: string): MemoryEntry[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  return parseMemoryMarkdown(content, filePath);
}

export interface ParsedMemoryFiles {
  readonly entries: readonly MemoryEntry[];
  readonly perFile: Readonly<Record<string, { count: number; bytes: number; estTokens: number }>>;
}

/** Parse the standard Hermes markdown files discovered by listHermesFiles. */
export function parseHermesFiles(files: readonly string[]): ParsedMemoryFiles {
  const entries: MemoryEntry[] = [];
  const perFile: Record<string, { count: number; bytes: number; estTokens: number }> = {};

  for (const file of files) {
    const parsed = parseMemoryFile(file);
    entries.push(...parsed);
    if (parsed.length > 0) {
      perFile[file] = {
        count: parsed.length,
        bytes: parsed.reduce((s, e) => s + e.bytes, 0),
        estTokens: parsed.reduce((s, e) => s + e.estTokens, 0),
      };
    }
  }

  return { entries, perFile };
}
