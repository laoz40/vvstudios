/**
 * Local-only E2E for the package approve-and-schedule happy path.
 * Uses live Convex, Clerk admin auth, Google Calendar, and Resend (no seeding).
 *
 * Prerequisites
 * `E2E_RESEND_API_KEY` or `RESEND_API_KEY` in `.env.local` (same Resend account Convex uses to send).
 * `E2E_ADMIN_EMAIL` for an admin user on the e2e Clerk instance (`publicMetadata.role` = `admin`).
 * `E2E_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY` for `@clerk/testing` (same Clerk instance as `VITE_CLERK_PUBLISHABLE_KEY`).
 * Run with `bun run test:e2e:package-schedule` (`--workers=1` avoids slot/email collisions).
 *
 * 1. Package request, admin payment confirmation, and first session scheduling
 *    Submit a package booking, confirm payment in the admin dashboard, poll Resend for the scheduling link,
 *    schedule session 1 of N, and read back the updated scheduling UI.
 */
import { test } from "@playwright/test";
import {
	getE2eAdminEmail,
	getE2eClerkSecretKey,
	prepareClerkTesting,
	signInAsAdmin
} from "./helpers/admin-auth";
import { confirmPackagePaymentForCustomer } from "./helpers/admin-packages";
import {
	agreeToTerms,
	expectPackageRequestComplete,
	expectTermsDialog,
	fillPackageBookingForm,
	getE2eDayIndexBucket,
	submitBookingForm
} from "./helpers/booking-form";
import {
	expectFirstPackageSessionScheduled,
	scheduleFirstPackageSession
} from "./helpers/package-schedule-form";
import { waitForPackageScheduleUrl } from "./helpers/resend";

const resendApiKey = process.env.E2E_RESEND_API_KEY ?? process.env.RESEND_API_KEY;
const adminEmail = getE2eAdminEmail();
const clerkSecretKey = getE2eClerkSecretKey();
const packageSize = 4;

test.describe("package schedule", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async () => {
		await prepareClerkTesting();
	});

	test("package request, admin payment confirmation, and first session scheduling", async ({
		page
	}) => {
		test.skip(
			!resendApiKey || !adminEmail || !clerkSecretKey,
			"Set E2E_RESEND_API_KEY, E2E_ADMIN_EMAIL, and E2E_CLERK_SECRET_KEY in .env.local."
		);

		test.setTimeout(300_000);

		const startedAt = new Date();
		const bookingDayIndex = getE2eDayIndexBucket();

		await page.goto("/book");

		const contactDetails = await fillPackageBookingForm(page, { packageSize });
		await submitBookingForm(page);
		await expectTermsDialog(page);
		await agreeToTerms(page);
		await expectPackageRequestComplete(page, packageSize);

		await signInAsAdmin(page);
		await confirmPackagePaymentForCustomer(page, {
			customerEmail: contactDetails.email,
			customerName: contactDetails.name
		});

		const scheduleUrl = await waitForPackageScheduleUrl({
			apiKey: resendApiKey!,
			packageSize,
			recipient: contactDetails.email,
			since: startedAt,
			timeoutMs: 120_000
		});

		await page.goto(scheduleUrl);
		await scheduleFirstPackageSession(page, { monthOffset: 1, startingDayIndex: bookingDayIndex });
		await expectFirstPackageSessionScheduled(page, packageSize);
	});
});
