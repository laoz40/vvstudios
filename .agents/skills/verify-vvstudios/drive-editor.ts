#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, expect, type Page } from "@playwright/test";
import {
	prepareClerkTesting,
	signInAsAdmin,
	signInWithEmail
} from "../../../e2e/helpers/admin-auth.ts";
import { createTempClerkEditor, deleteTempClerkEditor } from "./clerk-temp-editor.ts";
import { BASE_URL, REPO_ROOT, missingEnvKeys } from "./lib.ts";

const HELP = `verify-vvstudios drive-editor — create a temp Clerk editor, assign a confirmed session, prove the row, delete the Clerk user

Usage:
  bun .agents/skills/verify-vvstudios/drive-editor.ts

Requires E2E_ADMIN_EMAIL and E2E_CLERK_SECRET_KEY or CLERK_SECRET_KEY.
Creates a Clerk user with a +clerk_test email, then deletes it. Does not print secrets.
Writes screenshots under tmp/verify-vvstudios/<run-id>/.
`;

function fail(reason: string): never {
	console.error(reason);
	process.exit(1);
}

async function signOutToLogin(page: Page) {
	await page.getByRole("button", { name: "Sign out" }).first().click();
	await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
	await expect(page.getByRole("heading", { name: "Administrator login" })).toBeVisible({
		timeout: 20_000
	});
}

async function openEditorAssignSelect(page: Page) {
	const trigger = page.getByLabel(/Editor assigned to /).or(page.getByText("No editor assigned"));

	await expect(trigger.first()).toBeVisible({ timeout: 10_000 });
	await trigger.first().focus();
	await page.keyboard.press("Enter");

	return trigger.first();
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log(HELP.trim());
	process.exit(0);
}

const bootMissing = missingEnvKeys();

if (bootMissing.length > 0) {
	fail(`Missing required env: ${bootMissing.join(", ")} (set in .env.local)`);
}

if (!process.env.E2E_ADMIN_EMAIL) {
	fail("Missing E2E_ADMIN_EMAIL");
}

if (!process.env.E2E_CLERK_SECRET_KEY && !process.env.CLERK_SECRET_KEY) {
	fail("Missing E2E_CLERK_SECRET_KEY or CLERK_SECRET_KEY");
}

const runId = process.env.RUN_ID ?? String(Date.now());

const outDir = path.join(REPO_ROOT, "tmp/verify-vvstudios", runId);

fs.mkdirSync(outDir, { recursive: true });

await prepareClerkTesting();

const browser = await chromium.launch();

const page = await browser.newPage({
	baseURL: BASE_URL,
	viewport: { width: 1280, height: 800 },
	timezoneId: "Australia/Sydney"
});

let tempEditor: Awaited<ReturnType<typeof createTempClerkEditor>>;

try {
	tempEditor = await createTempClerkEditor();
} catch (error) {
	await browser.close();
	throw error;
}

let runError: string | null = null;

let assignment: { label: string; previousEditor: string } | null = null;

fs.writeFileSync(
	path.join(outDir, "cleanup.json"),
	JSON.stringify({ tempEditor, assignment }, null, 2)
);

try {
	await signInWithEmail(page, tempEditor.email);
	await expect(page.getByRole("tab", { name: "Edits" })).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("tab", { name: "History" })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Sessions", exact: true })).toHaveCount(0);
	await signOutToLogin(page);

	await signInAsAdmin(page);
	await expect(page.getByRole("tab", { name: "Sessions", exact: true })).toBeVisible({
		timeout: 30_000
	});
	await page.getByRole("button", { name: "Open session actions" }).first().click();

	const assignTrigger = await openEditorAssignSelect(page);
	const assignLabel = await assignTrigger.getAttribute("aria-label");
	const customerFromLabel = assignLabel?.replace(/^Editor assigned to /u, "").trim();

	const customerName = customerFromLabel;

	if (!customerName) {
		throw new Error("Could not read customer name from Editor assigned to combobox");
	}

	const editorOption = page.getByRole("option", { name: tempEditor.displayName });

	if ((await editorOption.count()) === 0) {
		throw new Error("Temp editor did not appear in the assign list after first sign-in");
	}

	if (!assignLabel) throw new Error("Assignment control has no accessible label");
	const previousEditor = (await assignTrigger.textContent())?.trim();

	if (!previousEditor) throw new Error("Could not read original editor assignment");
	assignment = { label: assignLabel, previousEditor };
	fs.writeFileSync(
		path.join(outDir, "cleanup.json"),
		JSON.stringify({ tempEditor, assignment }, null, 2)
	);

	await editorOption.click();
	await expect(
		page.getByRole("heading", { name: /Assign editor\?|Reassign editor\?/ })
	).toBeVisible();
	await page.getByRole("button", { name: "Confirm assignment" }).click();
	await expect(page.getByText("Editor assigned.")).toBeVisible({ timeout: 15_000 });
	await page.screenshot({ path: path.join(outDir, "admin-assign.png") });

	await signOutToLogin(page);
	await signInWithEmail(page, tempEditor.email);
	await expect(page.getByRole("tab", { name: "Edits" })).toBeVisible({ timeout: 30_000 });

	if (await page.getByRole("heading", { name: "Nothing in your queue" }).isVisible()) {
		await page.getByRole("tab", { name: "History" }).click();
	}

	await expect(page.getByText(customerName, { exact: true })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole("columnheader", { name: "Deliverables" })).toBeVisible();
	await page.screenshot({ path: path.join(outDir, "editor-assigned.png") });

	fs.writeFileSync(
		path.join(outDir, "notes.txt"),
		[
			"feature: editor-dashboard",
			"entry: /dashboard (editor assigned sessions)",
			`runId: ${runId}`,
			`assignedCustomer: ${customerName}`,
			"cleanup: see cleanup.txt for assignment restore, profile retirement, and Clerk deletion"
		].join("\n") + "\n"
	);
} catch (error) {
	await page.screenshot({ path: path.join(outDir, "failure.png"), fullPage: true }).catch(() => {});
	runError = error instanceof Error ? error.message : String(error);
} finally {
	const cleanupNotes: string[] = [];

	try {
		execFileSync("bun", [path.join(REPO_ROOT, ".agents/skills/verify-vvstudios/doctor.ts")], {
			cwd: REPO_ROOT,
			stdio: "pipe"
		});

		const cleanupPage = await browser.newPage({
			baseURL: BASE_URL,
			viewport: { width: 1280, height: 800 }
		});

		await signInAsAdmin(cleanupPage);
		await expect(cleanupPage.getByRole("tab", { name: "Sessions", exact: true })).toBeVisible({
			timeout: 30_000
		});

		if (assignment) {
			await cleanupPage.getByRole("tab", { name: "All sessions", exact: true }).click();
			await cleanupPage
				.getByPlaceholder("Search sessions...")
				.fill(assignment.label.replace(/^Editor assigned to /u, ""));
			await cleanupPage
				.getByRole("row")
				.filter({ hasText: tempEditor.displayName })
				.getByRole("button", { name: "Open session actions" })
				.click();
			const trigger = cleanupPage.getByRole("combobox", { name: assignment.label, exact: true });
			await trigger.focus();
			await cleanupPage.keyboard.press("Enter");
			await cleanupPage
				.getByRole("option", { name: assignment.previousEditor, exact: true })
				.click();

			const confirm =
				assignment.previousEditor === "No editor assigned"
					? "Confirm unassignment"
					: "Confirm assignment";

			await cleanupPage.getByRole("button", { name: confirm, exact: true }).click();
			await expect(trigger).toHaveText(assignment.previousEditor, { timeout: 15_000 });
			cleanupNotes.push("Original session assignment restored through admin UI.");
			await cleanupPage.keyboard.press("Escape");
		}

		await cleanupPage.getByRole("tab", { name: "Contractors", exact: true }).click();
		await expect(cleanupPage.getByText("Loading contractors", { exact: true })).toBeHidden({
			timeout: 30_000
		});

		const editorRow = cleanupPage
			.getByRole("row")
			.filter({ has: cleanupPage.getByText(tempEditor.displayName, { exact: true }) });

		if (await editorRow.count()) {
			await editorRow.getByRole("button", { name: "Open contractor actions" }).click();
			await cleanupPage.getByRole("menuitem", { name: "Retire contractor", exact: true }).click();
			await expect(editorRow).toHaveCount(0);
			await cleanupPage.getByRole("switch", { name: "Show retired" }).click();
			await expect(editorRow).toBeVisible();
			await cleanupPage.screenshot({ path: path.join(outDir, "editor-retired.png") });
			cleanupNotes.push(
				"Temporary editor profile retired through admin UI; inactive history remains."
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		cleanupNotes.push(`UI cleanup failed: ${message}`);
		runError = [runError, `UI cleanup failed: ${message}`].filter(Boolean).join("\n");
	} finally {
		await browser.close();

		try {
			await deleteTempClerkEditor(tempEditor.userId);
			cleanupNotes.push("Temporary Clerk user deleted.");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			cleanupNotes.push(message);
			runError = [runError, message].filter(Boolean).join("\n");
		}

		fs.writeFileSync(path.join(outDir, "cleanup.txt"), cleanupNotes.join("\n") + "\n");
	}
}

if (runError !== null) {
	fail(runError);
}

console.log(`OK: editor proof and cleanup written to ${outDir}`);
