import { test } from "@playwright/test";
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

// Local only — Stripe hCaptcha blocks headless payment in CI.
test("single session payment completes booking", async ({ page }) => {
	test.setTimeout(180_000);

	await page.goto("/book");

	try {
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
