import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { printStats, runPrune, runDedupe, parseArgs } from "../src/cli.js";

/**
 * /hermes-cleanup — Hermes memory storage report and safe cleanup.
 *
 * Usage:
 *   /hermes-cleanup                     storage + entry + duplicate report
 *   /hermes-cleanup prune [--keep N] [--confirm]
 *   /hermes-cleanup dedupe [--confirm] [--remove FILE#IDX ...]
 *
 * Mutating subcommands are dry-run unless --confirm is passed.
 */
export default function piHermesMemoryCleanup(pi: ExtensionAPI) {
	pi.registerCommand("hermes-cleanup", {
		description: "Hermes memory report and cleanup (prune/dedupe, dry-run default)",
		handler: async (args, ctx) => {
			const parsed = parseArgs(args.trim().split(/\s+/).filter(Boolean));
			try {
				const output =
					parsed.command === "prune"
						? runPrune(parsed)
						: parsed.command === "dedupe"
							? runDedupe(parsed)
							: printStats();

				if (ctx.mode === "tui") {
					await ctx.ui.editor(`Hermes Memory Cleanup — ${parsed.command}`, output);
				} else {
					ctx.ui.notify(output, "info");
				}
			} catch (err) {
				ctx.ui.notify(`hermes-cleanup failed: ${err}`, "error");
			}
		},
	});
}
