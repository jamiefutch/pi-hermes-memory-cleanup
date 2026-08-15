import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { printStats, runPrune, runDedupe, parseArgs, type CliArgs } from "../src/cli.js";

/**
 * /memory-cleanup — Hermes memory storage report and safe cleanup.
 * Part of the pi-hermes-memory command family (memory-*).
 *
 * No args (TUI): interactive menu — Report / Prune / Dedupe.
 * With args:     direct passthrough — report | prune [--keep N] [--confirm]
 *                | dedupe [--confirm] [--remove FILE#IDX ...]
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
			"🧹 Prune recovery files — keep newest 10 per file",
			"🔁 Dedupe entries — remove exact dupes + superseded",
			"❓ Help",
			"← Exit",
		]);

		if (!choice || choice.startsWith("←")) return;

		try {
			if (choice.startsWith("📊")) {
				await ctx.ui.editor("Hermes Memory Report", printStats());
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

const HELP = `Hermes Memory Cleanup

Report  — storage sizes, entry counts, estimated injected tokens,
          stalest entries, duplicates, superseded entries.

Prune   — deletes old .recovery-* snapshots, keeping the newest 10
          per file (MEMORY.md, USER.md, failures.md).

Dedupe  — removes extra copies of exact-duplicate entries (keeps the
          newest) and entries superseded by a newer, larger entry.
          Backs up affected files to .cleanup-backups/ first.

Every mutating operation shows a dry-run preview and asks for
confirmation before changing anything.

CLI equivalents (also usable as args):
  /memory-cleanup report
  /memory-cleanup prune --keep 5 --confirm
  /memory-cleanup dedupe --confirm --remove MEMORY.md#3`;
