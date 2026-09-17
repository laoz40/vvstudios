/**
 * Local-only E2E for package Stripe checkout through first session scheduling.
 * Uses live Stripe, Convex, Google Calendar, and Resend (no seeding).
 *
 * Prerequisites
 * Stripe test keys in `.env.local` (same as dev Convex deployment). Not run in CI — Stripe hCaptcha
 * blocks headless Pay in GitHub Actions.
 * `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local` (same Resend account Convex uses to send).
 *
 * 1. Package payment completes booking and schedules session 1
 *    Fill the package form, pay with a test card, assert `/booking-complete`, poll Resend for the
 *    scheduling link, schedule session 1 of N, and read back the updated scheduling UI.
 */
import { test } from "@playwright/test";
import {
	agreeToTerms,
	closePaymentModal,
	completeStripePayment,
	expectBookingConfirmed,
	expectPaymentModal,
	expectTermsDialog,
	fillPackageBookingForm,
	getE2eBookingSlotOffset,
	submitBookingForm
} from "./helpers/booking-form";
import {
	expectFirstPackageSessionScheduled,
	scheduleFirstPackageSession
} from "./helpers/package-schedule-form";
import { waitForPackageScheduleUrl } from "./helpers/resend";

const resendApiKey = process.env.E2E_RESEND_API_KEY ?? process.env.RESEND_API_KEY;

const packageSize = 4;

test.describe("package payment", () => {
	test.describe.configure({ mode: "serial" });

	test("package payment completes booking and schedules session 1", async ({ page }) => {
		test.skip(
			!resendApiKey,
			"Set E2E_RESEND_API_KEY or RESEND_API_KEY in .env.local (same Resend account Convex uses to send)."
		);

		test.setTimeout(180_000);

		const startedAt = new Date();
		const bookingSlot = getE2eBookingSlotOffset();

		await page.goto("/book");

		try {
			const contactDetails = await fillPackageBookingForm(page, { packageSize });
			await submitBookingForm(page);
			await expectTermsDialog(page);
			await agreeToTerms(page);
			await expectPaymentModal(page);
			await completeStripePayment(page);
			await expectBookingConfirmed(page, { packageSize });

			const scheduleUrl = await waitForPackageScheduleUrl({
				apiKey: resendApiKey!,
				packageSize,
				recipient: contactDetails.email,
				since: startedAt
			});

			await page.goto(scheduleUrl);
			await scheduleFirstPackageSession(page, bookingSlot);
			await expectFirstPackageSessionScheduled(page, packageSize);
		} finally {
			if (page.url().includes("/book")) {
				await closePaymentModal(page);
			}
		}
	});
});
