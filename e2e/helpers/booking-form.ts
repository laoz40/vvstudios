import { expect, type Page } from "@playwright/test";

export interface BookingContactDetails {
	accountName: string;
	email: string;
	name: string;
	phone: string;
}

export interface FillBookingFormOptions {
	contactDetails?: BookingContactDetails;
	monthOffset?: number;
	startingDayIndex?: number;
}

export type PackageSizeOption = 4 | 8 | 12;

export interface FillPackageBookingFormOptions {
	contactDetails?: BookingContactDetails;
	packageSize?: PackageSizeOption;
}

function createDefaultContactDetails(): BookingContactDetails {
	return {
		name: "Alex Tester",
		phone: "0400 000 000",
		accountName: "Alex Test Account",
		// Resend test sink: passes MX checks, never delivers to a real mailbox.
		email: `delivered+e2e.booking.${Date.now()}@resend.dev`
	};
}

/** Spread E2E bookings across bookable days so reruns don't fight the same Google Calendar slot. */
export function getE2eDayIndexBucket(bucketCount = 5) {
	return Math.floor(Date.now() / 60_000) % bucketCount;
}

async function waitForCalendarAvailability(page: Page) {
	const loadingAvailability = page.getByText("Loading availability...");
	const calendar = page.locator('[data-slot="calendar"]');

	// Busy-window fetch starts after mount once the rate-limit key is set in useEffect.
	await loadingAvailability.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

	if (await loadingAvailability.isVisible()) {
		await loadingAvailability.waitFor({ state: "hidden", timeout: 30_000 });
	}

	await expect
		.poll(async () => calendar.locator("button[data-day]:not([disabled])").count(), {
			timeout: 15_000
		})
		.toBeGreaterThan(0);
}

async function waitForBookingDateSelected(timeField: ReturnType<Page["locator"]>) {
	await expect(timeField.getByText("Select a date to view times.")).toBeHidden({ timeout: 30_000 });
}

async function readDayTimeSelectionState(
	timeField: ReturnType<Page["locator"]>
): Promise<"available" | "unavailable" | "pending"> {
	const firstTimeLabel = timeField.locator("label").first();
	const noTimesMessage = timeField.getByText("No times available for this date.");
	const selectDateMessage = timeField.getByText("Select a date to view times.");
	const loadingAvailability = timeField.getByText("Loading availability...");

	if (await firstTimeLabel.isVisible()) {
		return "available";
	}

	if (await noTimesMessage.isVisible()) {
		return "unavailable";
	}

	if ((await selectDateMessage.isVisible()) || (await loadingAvailability.isVisible())) {
		return "pending";
	}

	return "pending";
}

async function pickTimeForDayAtIndex(
	calendar: ReturnType<Page["locator"]>,
	timeField: ReturnType<Page["locator"]>,
	dayIndex: number,
	timeIndex = 0
): Promise<boolean> {
	const enabledDays = calendar.locator("button[data-day]:not([disabled])");
	const dayCount = await enabledDays.count();

	if (dayIndex >= dayCount) {
		return false;
	}

	const dayButton = enabledDays.nth(dayIndex);
	let timeSelection: "available" | "unavailable" | undefined;

	try {
		await expect(async () => {
			await dayButton.scrollIntoViewIfNeeded();
			await dayButton.click();
			await waitForBookingDateSelected(timeField);

			const state = await readDayTimeSelectionState(timeField);

			if (state === "pending") {
				throw new Error("Waiting for time slots after date selection");
			}

			timeSelection = state;
		}).toPass({ timeout: 15_000 });
	} catch {
		return false;
	}

	if (timeSelection === undefined || timeSelection === "unavailable") {
		return false;
	}

	const timeLabels = timeField.locator("label");
	const timeCount = await timeLabels.count();

	if (timeCount === 0) {
		return false;
	}

	await timeLabels.nth(Math.min(timeIndex, timeCount - 1)).click();
	return true;
}

async function tryPickBookableDayFromIndex(
	calendar: ReturnType<Page["locator"]>,
	timeField: ReturnType<Page["locator"]>,
	dayIndex: number,
	dayCount: number,
	timeIndex: number
): Promise<boolean> {
	if (dayIndex >= dayCount) {
		return false;
	}

	const picked = await pickTimeForDayAtIndex(calendar, timeField, dayIndex, timeIndex);

	if (picked) {
		return true;
	}

	return tryPickBookableDayFromIndex(calendar, timeField, dayIndex + 1, dayCount, timeIndex);
}

async function pickBookableDateInMonth(
	page: Page,
	monthAttempt: number,
	startingDayIndex: number,
	timeIndex: number
): Promise<void> {
	const calendar = page.locator('[data-slot="calendar"]');
	const timeField = page.locator('[data-field-name="time"]');
	const enabledDays = calendar.locator("button[data-day]:not([disabled])");
	const dayCount = await enabledDays.count();

	const picked = await tryPickBookableDayFromIndex(
		calendar,
		timeField,
		startingDayIndex,
		dayCount,
		timeIndex
	);

	if (picked) {
		return;
	}

	if (monthAttempt >= 2) {
		throw new Error("No bookable date and time found in the next 3 months");
	}

	await calendar.getByRole("button", { name: "Go to the Next Month" }).click();
	await waitForCalendarAvailability(page);
	await pickBookableDateInMonth(page, monthAttempt + 1, 0, timeIndex);
}

async function advanceCalendarMonths(page: Page, monthOffset: number) {
	if (monthOffset <= 0) {
		return;
	}

	const calendar = page.locator('[data-slot="calendar"]');
	await calendar.getByRole("button", { name: "Go to the Next Month" }).click();
	await waitForCalendarAvailability(page);
	await advanceCalendarMonths(page, monthOffset - 1);
}

export async function pickFirstBookableDateAndTime(
	page: Page,
	startingDayIndex = 0,
	monthOffset = 0,
	timeIndex = 0
) {
	await waitForCalendarAvailability(page);
	await advanceCalendarMonths(page, monthOffset);
	await pickBookableDateInMonth(page, 0, startingDayIndex, timeIndex);
}

async function selectBookingRadio(page: Page, labelSelector: string, radioSelector: string) {
	const label = page.locator(labelSelector);

	await expect(label).toBeVisible();

	await expect(async () => {
		await label.click();
		await expect(page.locator(radioSelector)).toBeChecked();
	}).toPass({ timeout: 15_000 });
}

export async function fillSingleSessionBookingForm(
	page: Page,
	options: FillBookingFormOptions = {}
): Promise<BookingContactDetails> {
	const contactDetails = options.contactDetails ?? createDefaultContactDetails();
	const startingDayIndex = options.startingDayIndex ?? 0;
	const monthOffset = options.monthOffset ?? 0;

	await expect(page.getByRole("heading", { name: "Studio Hire Booking" })).toBeVisible();
	await expect(page.getByRole("radio", { name: /Single Session/ })).toBeChecked({
		timeout: 15_000
	});

	await selectBookingRadio(
		page,
		'[data-field-name="duration"] label[for="duration-2h"]',
		"#duration-2h"
	);
	await selectBookingRadio(
		page,
		'[data-field-name="service"] label[for="service-table-setup"]',
		"#service-table-setup"
	);

	await waitForCalendarAvailability(page);
	await pickFirstBookableDateAndTime(page, startingDayIndex, monthOffset);

	await page.getByLabel("Full Name *").fill(contactDetails.name);
	await page.getByLabel("Mobile Number *").fill(contactDetails.phone);
	await page.getByLabel("Account Name *").fill(contactDetails.accountName);
	await page.getByLabel("Email *").fill(contactDetails.email);

	return contactDetails;
}

export async function fillPackageBookingForm(
	page: Page,
	options: FillPackageBookingFormOptions = {}
): Promise<BookingContactDetails> {
	const contactDetails = options.contactDetails ?? createDefaultContactDetails();
	const packageSize = options.packageSize ?? 4;

	await expect(page.getByRole("heading", { name: "Studio Hire Booking" })).toBeVisible();

	await selectBookingRadio(
		page,
		'[data-field-name="bookingMode"] label[for="booking-mode-package"]',
		"#booking-mode-package"
	);
	await expect(page.getByText("Package size *")).toBeVisible({ timeout: 15_000 });
	await selectBookingRadio(
		page,
		`[data-field-name="packageSize"] label[for="package-size-${packageSize}"]`,
		`#package-size-${packageSize}`
	);
	await selectBookingRadio(
		page,
		'[data-field-name="duration"] label[for="duration-2h"]',
		"#duration-2h"
	);

	await page.getByLabel("Full Name *").fill(contactDetails.name);
	await page.getByLabel("Mobile Number *").fill(contactDetails.phone);
	await page.getByLabel("Account Name *").fill(contactDetails.accountName);
	await page.getByLabel("Email *").fill(contactDetails.email);

	return contactDetails;
}

export async function submitBookingForm(page: Page) {
	await page.getByRole("button", { name: "COMPLETE BOOKING" }).click();
}

export async function expectTermsDialog(page: Page) {
	const dialog = page.getByRole("dialog");

	await expect(dialog.getByText("Terms & Conditions")).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Agree & Book" })).toBeVisible();
}

export async function agreeToTerms(page: Page) {
	const dialog = page.getByRole("dialog");

	await dialog.getByRole("button", { name: "Agree & Book" }).click();
}

export async function expectPaymentModal(page: Page) {
	const paymentDialog = page.getByRole("dialog");

	await expect(page.getByRole("button", { name: "Close payment modal" })).toBeVisible({
		timeout: 45_000
	});
	await expect(paymentDialog.locator("iframe").first()).toBeVisible({ timeout: 30_000 });
}

export async function expectNoPaymentModal(page: Page) {
	await expect(page.getByRole("button", { name: "Close payment modal" })).toBeHidden({
		timeout: 5_000
	});
}

export async function expectPackageRequestComplete(page: Page, packageSize: PackageSizeOption = 4) {
	await expect(page).toHaveURL(/\/package-complete/, { timeout: 45_000 });
	await expect(page).toHaveURL(new RegExp(`package_size=${packageSize}`));
	await expect(
		page.getByRole("heading", { name: `${packageSize}-Session Package requested.` })
	).toBeVisible();
	await expect(page.getByText("Next Steps:")).toBeVisible();
	await expect(page.getByText("Pay your invoice")).toBeVisible();
}

export async function closePaymentModal(page: Page) {
	const closeButton = page.getByRole("button", { name: "Close payment modal" });

	if (!(await closeButton.isVisible())) {
		return;
	}

	await closeButton.click();
	await expect(closeButton).toBeHidden({ timeout: 15_000 });
}

function stripeCheckoutFrame(page: Page) {
	const paymentDialog = page.getByRole("dialog");

	return paymentDialog.frameLocator("iframe").first();
}

export async function completeStripePayment(page: Page) {
	const checkout = stripeCheckoutFrame(page);

	await expect(checkout.getByText("TEST MODE")).toBeVisible({ timeout: 60_000 });

	const cardNumber = checkout.getByRole("textbox", { name: "Card number" });
	await expect(cardNumber).toBeEditable({ timeout: 30_000 });
	await cardNumber.fill("4242 4242 4242 4242");
	await checkout.getByRole("textbox", { name: "Expiration" }).fill("12 / 34");
	await checkout.getByRole("textbox", { name: "Credit or debit card CVC/CVV" }).fill("123");

	const cardholderName = checkout.locator('input[autocomplete="cc-name"]');
	if (await cardholderName.isVisible()) {
		await cardholderName.fill("Alex Tester");
	}

	const phoneNumber = checkout.getByRole("textbox", { name: "Phone number" });
	if (await phoneNumber.isVisible()) {
		await phoneNumber.fill("0400 000 000");
	}

	const payButton = checkout.getByRole("button", { name: /^Pay/i });
	await expect(payButton).toBeEnabled({ timeout: 10_000 });

	await Promise.all([
		page.waitForURL(/\/booking-complete/, { timeout: 120_000 }),
		payButton.click()
	]);
}

export async function expectBookingConfirmed(page: Page) {
	await expect(page).toHaveURL(/session_id=/, { timeout: 10_000 });

	const paymentReceivedHeading = page.getByRole("heading", { name: /We received your payment/ });

	if (await paymentReceivedHeading.isVisible()) {
		throw new Error(
			"Checkout finished but the slot was taken (Google Calendar still busy). " +
				"Delete test events from calendars in GOOGLE_CALENDAR_AVAILABILITY_IDS, or rerun — " +
				"the test rotates startingDayIndex to spread bookings."
		);
	}

	await expect(page.getByRole("heading", { name: "Your booking is confirmed!" })).toBeVisible({
		timeout: 120_000
	});
}
