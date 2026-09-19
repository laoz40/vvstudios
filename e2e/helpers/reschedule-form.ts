import { expect, type Page } from "@playwright/test";
import { pickFirstBookableDateAndTime } from "./booking-form";

export interface ExistingBookingSummary {
	date: string;
	time: string;
}

export async function readExistingBookingSummary(page: Page): Promise<ExistingBookingSummary> {
	const summary = page
		.locator("section")
		.filter({ has: page.getByRole("heading", { name: "Existing booking" }) });

	const date = (await summary.locator("dd").nth(0).textContent())?.trim() ?? "";
	const time = (await summary.locator("dd").nth(1).textContent())?.trim() ?? "";

	return { date, time };
}

export async function completeReschedule(
	page: Page,
	options: { monthOffset?: number; startingDayIndex?: number; timeIndex?: number } = {}
) {
	await expect(page.getByRole("heading", { name: "Reschedule your booking" })).toBeVisible();
	// Different day and time than the original booking (first slot is often 8–10am every day).
	await pickFirstBookableDateAndTime(
		page,
		options.startingDayIndex ?? 1,
		options.monthOffset ?? 1,
		options.timeIndex ?? 1
	);

	await page.getByRole("button", { name: "UPDATE BOOKING" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("button", { name: "Update Booking" })).toBeVisible();
	await dialog.getByRole("button", { name: "Update Booking" }).click();
}

export async function expectRescheduleComplete(
	page: Page,
	options: { previousDate: string; previousTime: string }
) {
	await expect(page).toHaveURL(/\/reschedule-complete/, { timeout: 45_000 });
	await expect(page.getByRole("heading", { name: "Booking updated" })).toBeVisible({
		timeout: 45_000
	});

	const detailsSection = page
		.locator("section")
		.filter({ has: page.getByRole("heading", { name: "Booking Details" }) });

	const newDate = (await detailsSection.locator("dd").nth(0).textContent())?.trim() ?? "";
	const newTime = (await detailsSection.locator("dd").nth(2).textContent())?.trim() ?? "";

	const dateChanged = newDate !== options.previousDate;
	const timeChanged = newTime !== options.previousTime;

	expect(dateChanged || timeChanged).toBe(true);
}
