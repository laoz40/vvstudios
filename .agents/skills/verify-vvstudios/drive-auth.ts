#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { prepareClerkTesting, signInAsAdmin } from "../../../e2e/helpers/admin-auth.ts";
import { BASE_URL, REPO_ROOT, missingEnvKeys } from "./lib.ts";

const HELP = `verify-vvstudios drive-auth — Clerk /login then admin /dashboard

Usage:
  bun .agents/skills/verify-vvstudios/drive-auth.ts

Requires E2E_ADMIN_EMAIL and E2E_CLERK_SECRET_KEY or CLERK_SECRET_KEY.
Writes screenshots under tmp/verify-vvstudios/<run-id>/. Does not print secrets.
`;

function fail(reason: string): never {
	console.error(reason);
	process.exit(1);
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
	fail("Missing E2E_ADMIN_EMAIL (needed for Clerk testing sign-in)");
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

try {
	await page.goto(`${BASE_URL}/login`);
	await expect(page.getByRole("heading", { name: "Administrator login" })).toBeVisible({
		timeout: 20_000
	});
	await expect(page).toHaveTitle("Login | VV Studios");
	await expect(page.getByRole("link", { name: "booking page" })).toBeVisible();
	await expect(page.locator(".cl-rootBox").first()).toBeVisible({ timeout: 15_000 });
	await page.screenshot({ path: path.join(outDir, "login.png") });

	await signInAsAdmin(page);

	await expect(page.getByRole("tab", { name: "Sessions", exact: true })).toBeVisible({
		timeout: 30_000
	});
	await expect(page.getByRole("tab", { name: "Packages", exact: true })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Contractors", exact: true })).toBeVisible();
	const signOut = page.getByRole("button", { name: "Sign out" }).first();
	await expect(signOut).toBeVisible();
	await expect(page.getByPlaceholder("Search sessions...")).toBeVisible();
	await page.screenshot({ path: path.join(outDir, "dashboard-sessions.png") });

	await page.getByRole("tab", { name: "Packages", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Packages", exact: true })).toHaveAttribute(
		"data-state",
		"active"
	);
	await page.screenshot({ path: path.join(outDir, "dashboard-packages.png") });

	await page.getByRole("tab", { name: "Contractors", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Contractors", exact: true })).toHaveAttribute(
		"data-state",
		"active"
	);
	await page.screenshot({ path: path.join(outDir, "dashboard-contractors.png") });

	await signOut.click();
	await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
	await expect(page.getByRole("heading", { name: "Administrator login" })).toBeVisible({
		timeout: 20_000
	});
	await page.screenshot({ path: path.join(outDir, "login-after-sign-out.png") });

	fs.writeFileSync(
		path.join(outDir, "notes.txt"),
		[
			"feature: clerk-login + admin-dashboard",
			"entry: /login",
			`runId: ${runId}`,
			"signedOutHeading: Administrator login",
			"dashboardTabs: Sessions, Packages, Contractors"
		].join("\n") + "\n"
	);

	console.log(`OK: auth proof written to ${outDir}`);
} catch (error) {
	await page.screenshot({ path: path.join(outDir, "failure.png"), fullPage: true }).catch(() => {});
	const message = error instanceof Error ? error.message : String(error);
	fail(message);
} finally {
	await browser.close();
}
