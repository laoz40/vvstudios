/**
 * Merge-conflict lint check.
 *
 * Marker detection
 * Reports standard and diff3 conflicts with line numbers, including CRLF and custom marker sizes.
 *
 * Documentation examples
 * Allows inline markers, fenced examples, and Setext heading underlines.
 *
 * Tracked files
 * Rejects committed conflicts, permits valid tracked files, and ignores untracked files.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findMergeConflictLines } from "../../checks/merge-conflicts.ts";

const conflict = ["<<<<<<< HEAD", "ours", "||||||| base", "original", "=======", "theirs", ">>>>>>> branch"].join("\n");

void test("reports standard and diff3 markers with CRLF line numbers", () => {
	assert.deepEqual(findMergeConflictLines("source.ts", conflict.replaceAll("\n", "\r\n")), [1, 3, 5, 7]);
});

void test("reports custom marker sizes and permits shorter nonmarkers", () => {
	for (const size of [8, 12]) {
		const contents = ["<".repeat(size) + " HEAD", "ours", "|".repeat(size) + " base", "original", "=".repeat(size), "theirs", ">".repeat(size) + " branch"].join("\n");
		assert.deepEqual(findMergeConflictLines("source.ts", contents), [1, 3, 5, 7]);
	}

	assert.deepEqual(findMergeConflictLines("guide.md", "<<<<<< HEAD\n======\n>>>>>> branch"), []);
});

void test("reports orphan opening, ancestor, and closing markers", () => {
	for (const marker of ["<<<<<<<", "||||||| base", ">>>>>>> branch"]) {
		assert.deepEqual(findMergeConflictLines("guide.md", marker), [1]);
	}
});

void test("allows Markdown examples and heading underlines without hiding later conflicts", () => {
	for (const fence of ["```", "~~~~"]) {
		const example = [`${fence}text`, conflict, "``", fence, "Title", "=======", "Use `<<<<<<< HEAD`."];
		// A shorter delimiter is text, not a closing fence.
		const contents = [...example, conflict].join("\n");
		assert.deepEqual(findMergeConflictLines("guide.mdx", contents), [14, 16, 18, 20]);
	}
});

void test("does not treat source text as Markdown fences", () => {
	assert.deepEqual(findMergeConflictLines("source.ts", `\`\`\`\n${conflict}\n\`\`\``), [2, 4, 6, 8]);
});

void test("CLI rejects already committed conflicts and returns zero for valid tracked files", () => {
	const cwd = mkdtempSync(join(tmpdir(), "merge-conflicts-"));
	const script = fileURLToPath(new URL("../../checks/merge-conflicts.ts", import.meta.url));

	try {
		execFileSync("git", ["init", "--quiet"], { cwd });
		writeFileSync(join(cwd, "guide.md"), conflict);
		execFileSync("git", ["add", "guide.md"], { cwd });
		execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"], { cwd });
		const failed = spawnSync(process.execPath, ["--experimental-strip-types", script], { cwd, encoding: "utf8" });
		assert.equal(failed.status, 1);
		assert.match(failed.stderr, /guide\.md:1: unresolved merge-conflict marker/);

		writeFileSync(join(cwd, "guide.md"), `\`\`\`text\n${conflict}\n\`\`\`\n`);
		writeFileSync(join(cwd, "untracked.ts"), conflict);
		const passed = spawnSync(process.execPath, ["--experimental-strip-types", script], { cwd, encoding: "utf8" });
		assert.equal(passed.status, 0);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
