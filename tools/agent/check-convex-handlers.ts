#!/usr/bin/env bun
/**
 * Lists top-level convex/*.ts modules that export query/mutation/action handlers
 * but never reference tupleOk (likely missing the handler adapter pattern).
 * Internal modules and http.ts are skipped.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const convexRoot = path.join(here, "../../convex");
const skip = new Set(["http.ts", "schema.ts", "auth.config.ts", "crons.ts"]);

const handlerPattern =
	/export const \w+ = (query|mutation|action|internalQuery|internalMutation|internalAction)\(/;

const files = (await readdir(convexRoot)).filter((name) => name.endsWith(".ts") && !skip.has(name));

const missing: string[] = [];

for (const file of files) {
	const full = path.join(convexRoot, file);
	const text = await readFile(full, "utf8");
	if (!handlerPattern.test(text)) {
		continue;
	}
	if (!text.includes("tupleOk")) {
		missing.push(file);
	}
}

if (missing.length === 0) {
	console.log("All checked handler modules reference tupleOk.");
	process.exit(0);
}

console.log("Handler modules without tupleOk (verify thin adapter pattern manually):\n");
for (const file of missing) {
	console.log(`  convex/${file}`);
}
process.exit(1);
