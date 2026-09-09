/**
 * CI-safe E2E for the public booking form through terms and the payment modal.
 * Does not complete Stripe checkout (hCaptcha blocks headless Pay in GitHub Actions).
 *
 * Prerequisites
 * Shared dev/e2e Convex deployment and test Clerk/Stripe publishable keys (see `AGENTS.md`).
 * Run with `bun run test:e2e`.
 *
 * 1. Loads booking form sections
 *    Assert core form headings and fields render on `/book`.
 *
 * 2. Single session form opens terms dialog
 *    Fill a single-session booking and submit; terms dialog appears.
 *
 * 3. Single session checkout opens payment modal
 *    Agree to terms and assert the Stripe payment modal opens (modal closed in `finally`).
 *
 * 4. Package request reaches package-complete
 *    Fill a package booking, agree to terms, and assert `/package-complete` without opening the Stripe payment modal.
 */
import { expect, test } from "@playwright/test";
import {
	agreeToTerms,
	closePaymentModal,
	expectNoPaymentModal,
	expectPackageRequestComplete,
	expectPaymentModal,
	expectTermsDialog,
	fillPackageBookingForm,
	fillSingleSessionBookingForm,
	submitBookingForm
} from "./helpers/booking-form";

test.describe("book page", () => {
	test.describe.configure({ mode: "serial" });
	test("loads booking form sections", async ({ page }) => {
		await page.goto("/book");

		await expect(page.getByRole("heading", { name: "Studio Hire Booking" })).toBeVisible();
		await expect(page.getByText("Booking Type *")).toBeVisible();
		await expect(page.getByText("Session Duration *")).toBeVisible();
		await expect(page.getByText("Contact Details")).toBeVisible();
		await expect(page.getByText("Session Date *")).toBeVisible();
	});

	test("single session form opens terms dialog", async ({ page }) => {
		test.setTimeout(60_000);

		await page.goto("/book");

		await fillSingleSessionBookingForm(page);
		await submitBookingForm(page);
		await expectTermsDialog(page);
	});

	test("single session checkout opens payment modal", async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto("/book");

		try {
			await fillSingleSessionBookingForm(page);
			await submitBookingForm(page);
			await expectTermsDialog(page);
			await agreeToTerms(page);
			await expectPaymentModal(page);
		} finally {
			await closePaymentModal(page);
		}
	});

	test("package request reaches package-complete", async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto("/book");

		await fillPackageBookingForm(page);
		await submitBookingForm(page);
		await expectTermsDialog(page);
		await agreeToTerms(page);
		await expectPackageRequestComplete(page, 4);
		await expectNoPaymentModal(page);
	});
});
