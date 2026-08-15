import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { printStats, runPrune, runDedupe, runTrim, runLimits, parseArgs, type CliArgs } from "../src/cli.js";
import { listHermesFiles } from "../src/analyze.js";
import { parseHermesFiles } from "../src/parse.js";
import { entriesByCost } from "../src/trim.js";

/**
 * /memory-cleanup — Hermes memory storage report and safe cleanup.
 * Part of the pi-hermes-memory command family (memory-*).
 *
 * No args (TUI): interactive menu — Report / Limits / Trim / Prune / Dedupe.
 * With args:     direct passthrough — report | limits | trim | prune | dedupe
 *
 * Mutating operations are dry-run unless confirmed.
 */
export default function piHermesMemoryCleanup(pi: ExtensionAPI) {
	pi.registerCommand("memory-cleanup", {
		description: "Audit and safely clean Hermes memory storage (report, prune, dedupe)",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed && ctx.mode === "tui") {
				await showMenu(ctx);
				return;
			}
			runDirect(trimmed, ctx);
		},
	});
}

function runDirect(args: string, ctx: any): void {
	const parsed = parseArgs(args.split(/\s+/).filter(Boolean));
	try {
		const output =
			parsed.command === "prune"
				? runPrune(parsed)
				: parsed.command === "dedupe"
					? runDedupe(parsed)
					: parsed.command === "limits"
						? runLimits()
						: parsed.command === "trim"
							? runTrim(parsed)
							: printStats();
		if (ctx.mode === "tui") ctx.ui.editor(`Hermes Cleanup — ${parsed.command}`, output);
		else ctx.ui.notify(output, "info");
	} catch (err) {
		ctx.ui.notify(`memory-cleanup failed: ${err}`, "error");
	}
}

async function showMenu(ctx: any): Promise<void> {
	while (true) {
		const choice = await ctx.ui.select("Hermes Memory Cleanup", [
			"📊 Report — storage, entries, tokens, duplicates",
			"📏 Limits — configured injection caps vs usage",
			"✂️  Trim entries — pick entries to stop injecting",
			"🔁 Dedupe entries — remove exact dupes + superseded",
			"🧹 Prune recovery files — keep newest 10 per file",
			"❓ Help",
			"← Exit",
		]);

		if (!choice || choice.startsWith("←")) return;

		try {
			if (choice.startsWith("📊")) {
				await ctx.ui.editor("Hermes Memory Report", printStats());
			} else if (choice.startsWith("📏")) {
				await ctx.ui.editor("Hermes Injection Limits", runLimits());
			} else if (choice.startsWith("✂️")) {
				await trimFlow(ctx);
			} else if (choice.startsWith("🧹")) {
				await pruneFlow(ctx);
			} else if (choice.startsWith("🔁")) {
				await dedupeFlow(ctx);
			} else if (choice.startsWith("❓")) {
				await ctx.ui.editor("Hermes Cleanup Help", HELP);
			}
		} catch (err) {
			ctx.ui.notify(`memory-cleanup failed: ${err}`, "error");
		}
	}
}

async function pruneFlow(ctx: any): Promise<void> {
	const dryArgs: CliArgs = { command: "prune", confirm: false, keep: 10, remove: [] };
	const preview = runPrune(dryArgs);
	const confirmed = await ctx.ui.confirm("Prune recovery files (dry-run below)", `${preview}\n\nDelete these files?`);
	if (!confirmed) return;
	const result = runPrune({ ...dryArgs, confirm: true });
	await ctx.ui.editor("Prune result", result);
}

async function dedupeFlow(ctx: any): Promise<void> {
	const dryArgs: CliArgs = { command: "dedupe", confirm: false, keep: 10, remove: [] };
	const preview = runDedupe(dryArgs);
	if (preview.includes("Nothing to remove")) {
		await ctx.ui.editor("Dedupe", `${preview}\n\nNo exact duplicates or superseded entries found.`);
		return;
	}
	const confirmed = await ctx.ui.confirm("Dedupe entries (dry-run below)", `${preview}\n\nBack up and apply?`);
	if (!confirmed) return;
	const result = runDedupe({ ...dryArgs, confirm: true });
	await ctx.ui.editor("Dedupe result", result);
}

async function trimFlow(ctx: any): Promise<void> {
	const files = listHermesFiles();
	const markdownFiles = [files.memoryMd, files.userMd, files.failuresMd];
	const selected: string[] = [];

	while (true) {
		const { entries } = parseHermesFiles(markdownFiles);
		const picked = new Set(selected);
		const options = entriesByCost(entries)
			.filter((e) => !picked.has(`${shortName(e.file)}#${e.index}`))
			.map(
				(e) =>
					`~${String(e.estTokens).padStart(4)} tok  ${shortName(e.file)}#${e.index} — ${previewOf(e.text)}`,
			);

		const title = selected.length
			? `Trim entries — ${selected.length} queued for removal`
			: "Trim entries — pick an entry to queue for removal";
		const choice = await ctx.ui.select(title, [
			...(selected.length ? [`✅ Done — remove ${selected.length} queued entries`] : []),
			...options,
			"← Cancel",
		]);

		if (!choice || choice.startsWith("←")) return;

		if (choice.startsWith("✅")) {
			const args: CliArgs = { command: "trim", confirm: false, keep: 10, remove: selected };
			const previewText = runTrim(args);
			const confirmed = await ctx.ui.confirm("Trim entries (dry-run below)", `${previewText}\n\nBack up and remove?`);
			if (!confirmed) return;
			const result = runTrim({ ...args, confirm: true });
			await ctx.ui.editor("Trim result", result);
			return;
		}

		const m = choice.match(/(\S+\.md#\d+)/);
		if (m) selected.push(m[1]);
	}
}

function shortName(file: string): string {
	return file.split("/").pop() ?? file;
}

function previewOf(text: string, max = 55): string {
	const oneLine = text.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
	return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

const HELP = `Hermes Memory Cleanup

Report  — storage sizes, entry counts, estimated injected tokens,
          largest entries, stalest entries, duplicates, superseded.

Limits  — configured Hermes injection caps (memoryCharLimit,
          userCharLimit) vs actual usage, plus failures.md injection
          filters. Edit ~/.pi/agent/hermes-memory-config.json to tune.

Trim    — pick ANY entries to stop injecting into model context,
          sorted by token cost. Backup taken before removal.

Dedupe  — removes extra copies of exact-duplicate entries (keeps the
          newest) and entries superseded by a newer, larger entry.
          Backs up affected files to .cleanup-backups/ first.

Prune   — deletes old .recovery-* snapshots, keeping the newest 10
          per file (MEMORY.md, USER.md, failures.md).

Every mutating operation shows a dry-run preview and asks for
confirmation before changing anything.

CLI equivalents (also usable as args):
  /memory-cleanup report
  /memory-cleanup limits
  /memory-cleanup trim --confirm --remove MEMORY.md#3
  /memory-cleanup dedupe --confirm
  /memory-cleanup prune --keep 5 --confirm`;
