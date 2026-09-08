import { expect, type Page } from "@playwright/test";

export interface BookingContactDetails {
	accountName: string;
	email: string;
	name: string;
	phone: string;
}

const defaultContactDetails: BookingContactDetails = {
	name: "Alex Tester",
	phone: "0400 000 000",
	accountName: "Alex Test Account",
	email: `e2e+${Date.now()}@example.com`
};

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
		await expect(firstTimeLabel).toBeVisible({ timeout: 5_000 });
		await firstTimeLabel.click();
		return true;
	} catch {
		return pickTimeForDayAtIndex(calendar, timeField, dayIndex + 1);
	}
}

async function pickBookableDateInMonth(page: Page, monthAttempt: number): Promise<void> {
	const calendar = page.locator('[data-slot="calendar"]');
	const timeField = page.locator('[data-field-name="time"]');
	const picked = await pickTimeForDayAtIndex(calendar, timeField, 0);

	if (picked) {
		return;
	}

	if (monthAttempt >= 2) {
		throw new Error("No bookable date and time found in the next 3 months");
	}

	await calendar.getByRole("button", { name: "Go to the Next Month" }).click();
	await waitForCalendarAvailability(page);
	await pickBookableDateInMonth(page, monthAttempt + 1);
}

export async function pickFirstBookableDateAndTime(page: Page) {
	await waitForCalendarAvailability(page);
	await pickBookableDateInMonth(page, 0);
}

export async function fillSingleSessionBookingForm(
	page: Page,
	contactDetails: BookingContactDetails = defaultContactDetails
) {
	await page.locator('label[for="duration-2h"]').click();
	await page.locator('label[for="service-table-setup"]').click();

	await pickFirstBookableDateAndTime(page);

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
