import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Markdown examples may contain literal markers. Outside examples, inspect the
// entire tracked file, not just the diff, so committed conflicts also fail lint.
export function findMergeConflictLines(path: string, contents: string): number[] {
	const markdown = /\.(?:md|mdx)$/i.test(path);
	const lines: number[] = [];
	let fence = "";
	let conflict = false;

	for (const [index, line] of contents.split(/\r?\n/).entries()) {
		const delimiter = markdown ? /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line) : null;

		if (delimiter) {
			const marker = delimiter[1] ?? "";
			const trailing = delimiter[2] ?? "";

			if (!fence) {
				fence = marker;
			} else if (marker.startsWith(fence) && !trailing.trim()) {
				fence = "";
			}

			continue;
		}

		if (fence) continue;

		if (/^<{7,}(?: .*)?$/.test(line)) {
			conflict = true;
			lines.push(index + 1);
		} else if (/^(?:>{7,}|\|{7,})(?: .*)?$/.test(line)) {
			lines.push(index + 1);

			if (line.startsWith(">")) conflict = false;
		} else if (conflict && /^={7,}$/.test(line)) {
			lines.push(index + 1);
		}
	}

	return lines;
}

export function checkTrackedMergeConflicts(cwd: string): string[] {
	const paths = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" }).split("\0");
	const violations: string[] = [];

	for (const path of paths) {
		if (!path || !existsSync(`${cwd}/${path}`)) continue;

		const contents = readFileSync(`${cwd}/${path}`, "utf8");

		if (contents.includes("\0")) continue;

		for (const line of findMergeConflictLines(path, contents)) {
			violations.push(`${path}:${line}: unresolved merge-conflict marker`);
		}
	}

	return violations;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const violations = checkTrackedMergeConflicts(process.cwd());

	for (const violation of violations) console.error(violation);

	if (violations.length > 0) process.exitCode = 1;
}
