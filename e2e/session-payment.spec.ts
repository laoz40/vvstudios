/**
 * Local-only E2E for a single-session Stripe checkout that confirms the booking.
 * Uses live Stripe, Convex, and Google Calendar (no seeding).
 *
 * Prerequisites
 * Stripe test keys in `.env.local` (same as dev Convex deployment). Not run in CI — Stripe hCaptcha
 * blocks headless Pay in GitHub Actions.
 *
 * 1. Single session payment completes booking
 *    Fill the booking form, agree to terms, pay with a test card, and assert `/booking-complete`
 *    shows a confirmed booking.
 */
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
