import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";

let clerkTestingReady = false;

export function ensureClerkTestingEnv() {
	if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY) {
		process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
	}

	if (!process.env.CLERK_SECRET_KEY) {
		process.env.CLERK_SECRET_KEY = process.env.E2E_CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;
	}
}

export function getE2eAdminEmail() {
	return process.env.E2E_ADMIN_EMAIL;
}

export function getE2eClerkSecretKey() {
	return process.env.E2E_CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;
}

export async function prepareClerkTesting() {
	ensureClerkTestingEnv();

	if (!clerkTestingReady) {
		await clerkSetup();
		clerkTestingReady = true;
	}
}

export async function signInWithEmail(page: Page, email: string) {
	await page.goto("/login");
	await page.locator(".cl-rootBox").first().waitFor({ timeout: 20_000 });
	await setupClerkTestingToken({ page });
	await clerk.signIn({ page, emailAddress: email });
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

export async function signInAsAdmin(page: Page) {
	const email = getE2eAdminEmail();

	if (!email) {
		throw new Error("E2E_ADMIN_EMAIL is required for admin sign-in.");
	}

	await signInWithEmail(page, email);
}
