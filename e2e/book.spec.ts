import { expect, test } from "@playwright/test";
import {
	agreeToTerms,
	closePaymentModal,
	completeStripePayment,
	expectBookingConfirmed,
	expectPaymentModal,
	expectTermsDialog,
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

	test("single session payment completes booking", async ({ page }) => {
		test.skip(
			!process.env.E2E_STRIPE_WEBHOOK,
			"Set E2E_STRIPE_WEBHOOK=1 with stripe listen forwarding webhooks to Convex"
		);
		test.setTimeout(180_000);

		await page.goto("/book");

		try {
			// Next month avoids slots consumed by earlier serial tests in the current month.
			await fillSingleSessionBookingForm(page, { monthOffset: 1 });
			await submitBookingForm(page);
			await expectTermsDialog(page);
			await agreeToTerms(page);
			await expectPaymentModal(page);
			await completeStripePayment(page);
			await expectBookingConfirmed(page);
		} finally {
			if (page.url().includes("/book")) {
				await closePaymentModal(page);
			}
		}
	});
});
