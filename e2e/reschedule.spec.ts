/**
 * Local-only E2E for the customer reschedule happy path after a real checkout.
 * Uses live Stripe, Convex, Google Calendar, and Resend (no seeding, no dev scenarios).
 *
 * Prerequisites
 * `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local` (same Resend account Convex uses to send).
 * Convex `STRIPE_CHECKOUT_RETURN_URL` origin must be `http://localhost:3000` so invoice links open in Playwright.
 * Run with `bun run test:e2e:reschedule` (`--workers=1` avoids parallel payment tests colliding on slots).
 *
 * 1. Book, pay, and reschedule via invoice link
 *    Fill the booking form, complete Stripe checkout, poll Resend for the invoice reschedule URL,
 *    reschedule through the UI, and read back the updated date or time on `/reschedule-complete`.
 *    Slot indices rotate across runs so reruns are less likely to hit the same Google Calendar window.
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
	getE2eDayIndexBucket,
	submitBookingForm
} from "./helpers/booking-form";
import { waitForInvoiceRescheduleUrl } from "./helpers/resend";
import {
	completeReschedule,
	expectRescheduleComplete,
	readExistingBookingSummary
} from "./helpers/reschedule-form";

const resendApiKey = process.env.E2E_RESEND_API_KEY ?? process.env.RESEND_API_KEY;

test.describe("reschedule", () => {
	test.describe.configure({ mode: "serial" });

	test("book, pay, and reschedule via invoice link", async ({ page }) => {
		test.skip(
			!resendApiKey,
			"Set E2E_RESEND_API_KEY or RESEND_API_KEY in .env.local (same Resend account Convex uses to send)."
		);

		test.setTimeout(240_000);

		const startedAt = new Date();
		const bookingDayIndex = getE2eDayIndexBucket();

		await page.goto("/book");

		try {
			const contactDetails = await fillSingleSessionBookingForm(page, {
				monthOffset: 1,
				startingDayIndex: bookingDayIndex
			});

			await submitBookingForm(page);
			await expectTermsDialog(page);
			await agreeToTerms(page);
			await expectPaymentModal(page);
			await completeStripePayment(page);
			await expectBookingConfirmed(page);

			const rescheduleUrl = await waitForInvoiceRescheduleUrl({
				apiKey: resendApiKey!,
				recipient: contactDetails.email,
				since: startedAt,
				timeoutMs: 120_000
			});

			await page.goto(rescheduleUrl);

			const previousBooking = await readExistingBookingSummary(page);
			await completeReschedule(page, { monthOffset: 1, startingDayIndex: bookingDayIndex + 1 });
			await expectRescheduleComplete(page, {
				previousDate: previousBooking.date,
				previousTime: previousBooking.time
			});
		} finally {
			if (page.url().includes("/book")) {
				await closePaymentModal(page);
			}
		}
	});
});
