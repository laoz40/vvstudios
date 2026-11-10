import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const options = z
	.union([z.tuple([]), z.tuple([z.literal("--fix")])])
	.safeParse(process.argv.slice(2));

if (!options.success) {
	console.error("Usage: bun scripts/lint.ts [--fix]");
	process.exit(2);
}

const root = fileURLToPath(new URL("../", import.meta.url));

const tests = readdirSync(path.join(root, "tools/oxlint"), { recursive: true, encoding: "utf8" })
	.flatMap((file) => (file.endsWith(".test.ts") ? [path.join("tools/oxlint", file)] : []))
	.toSorted();

const checks = readdirSync(path.join(root, "tools/checks"), { withFileTypes: true })
	.flatMap((entry) =>
		entry.isFile() && entry.name.endsWith(".ts") ? [path.join("tools/checks", entry.name)] : []
	)
	.toSorted();

// Oxlint's TypeScript plugins, Node's test runner, and TSGo's native API need Node.
// Keep those runtime details here instead of repeating them in package.json.
const env = {
	...process.env,
	NODE_OPTIONS: [process.env.NODE_OPTIONS, "--experimental-strip-types"].filter(Boolean).join(" ")
};

const steps = [
	{ label: "Lint rule tests", command: "node", args: ["--test", "--test-concurrency=1", ...tests] },
	{
		label: "Oxlint",
		command: path.join(root, "node_modules/.bin/oxlint"),
		args: [".", ...options.data]
	},
	...checks.map((file) => ({ label: file, command: "node", args: [file] }))
];

const failures: string[] = [];

for (const step of steps) {
	console.error(`\nRunning ${step.label}`);
	const result = spawnSync(step.command, step.args, { cwd: root, env, stdio: "inherit" });

	if (result.error) console.error(result.error.message);

	if (result.status !== 0) failures.push(step.label);
}

if (failures.length > 0) {
	console.error(`\nLint failed: ${failures.join(", ")}`);
	process.exitCode = 1;
} else {
	console.error("\nLint passed");
}
