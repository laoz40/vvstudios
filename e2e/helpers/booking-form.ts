import { expect, type Page } from "@playwright/test";

export interface BookingContactDetails {
	accountName: string;
	email: string;
	name: string;
	phone: string;
}

export interface FillBookingFormOptions {
	contactDetails?: BookingContactDetails;
	startingDayIndex?: number;
}

function createDefaultContactDetails(): BookingContactDetails {
	return {
		name: "Alex Tester",
		phone: "0400 000 000",
		accountName: "Alex Test Account",
		email: `e2e.booking+${Date.now()}@gmail.com`
	};
}

async function waitForCalendarAvailability(page: Page) {
	const loadingAvailability = page.getByText("Loading availability...");

	if (await loadingAvailability.isVisible()) {
		await loadingAvailability.waitFor({ state: "hidden", timeout: 15_000 });
	}

	const calendar = page.locator('[data-slot="calendar"]');

	await expect
		.poll(async () => calendar.locator("button[data-day]:not([disabled])").count(), {
			timeout: 15_000
		})
		.toBeGreaterThan(0);
}

async function pickTimeForDayAtIndex(
	calendar: ReturnType<Page["locator"]>,
	timeField: ReturnType<Page["locator"]>,
	dayIndex: number
): Promise<boolean> {
	const enabledDays = calendar.locator("button[data-day]:not([disabled])");
	const dayCount = await enabledDays.count();

	if (dayIndex >= dayCount) {
		return false;
	}

	await enabledDays.nth(dayIndex).click();

	const firstTimeLabel = timeField.locator("label").first();

	try {
		await expect(firstTimeLabel).toBeVisible({ timeout: 3_000 });
		await firstTimeLabel.click();
		return true;
	} catch {
		return pickTimeForDayAtIndex(calendar, timeField, dayIndex + 1);
	}
}

async function pickBookableDateInMonth(
	page: Page,
	monthAttempt: number,
	startingDayIndex: number
): Promise<void> {
	const calendar = page.locator('[data-slot="calendar"]');
	const timeField = page.locator('[data-field-name="time"]');
	const picked = await pickTimeForDayAtIndex(calendar, timeField, startingDayIndex);

	if (picked) {
		return;
	}

	if (monthAttempt >= 2) {
		throw new Error("No bookable date and time found in the next 3 months");
	}

	await calendar.getByRole("button", { name: "Go to the Next Month" }).click();
	await waitForCalendarAvailability(page);
	await pickBookableDateInMonth(page, monthAttempt + 1, 0);
}

export async function pickFirstBookableDateAndTime(page: Page, startingDayIndex = 0) {
	await waitForCalendarAvailability(page);
	await pickBookableDateInMonth(page, 0, startingDayIndex);
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
) {
	const contactDetails = options.contactDetails ?? createDefaultContactDetails();
	const startingDayIndex = options.startingDayIndex ?? 0;

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

	await pickFirstBookableDateAndTime(page, startingDayIndex);

	await page.getByLabel("Full Name *").fill(contactDetails.name);
	await page.getByLabel("Mobile Number *").fill(contactDetails.phone);
	await page.getByLabel("Account Name *").fill(contactDetails.accountName);
	await page.getByLabel("Email *").fill(contactDetails.email);
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

export async function closePaymentModal(page: Page) {
	const closeButton = page.getByRole("button", { name: "Close payment modal" });

	if (!(await closeButton.isVisible())) {
		return;
	}

	await closeButton.click();
	await expect(closeButton).toBeHidden({ timeout: 15_000 });
}
