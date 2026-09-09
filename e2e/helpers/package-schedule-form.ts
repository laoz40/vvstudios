import { expect, type Page } from "@playwright/test";
import { pickFirstBookableDateAndTime } from "./booking-form";

export async function openFirstUnscheduledPackageSession(page: Page) {
	await expect(page.getByRole("heading", { name: "Schedule your package sessions" })).toBeVisible();

	const firstDateRequiredSession = page
		.locator('[data-slot="accordion-item"]')
		.filter({ hasText: "Date Required" })
		.first();

	await firstDateRequiredSession.getByText("SCHEDULE", { exact: true }).click();
	await expect(
		firstDateRequiredSession.getByRole("button", { name: "SAVE SESSION" })
	).toBeVisible();
}

async function selectPackageRecordingSpaceIfNeeded(page: Page) {
	const tableSetupRadio = page.locator("#package-session-service-table-setup");

	if (await tableSetupRadio.isChecked()) {
		return;
	}

	await page
		.locator('[data-field-name="service"] label[for="package-session-service-table-setup"]')
		.click();
	await expect(tableSetupRadio).toBeChecked();
}

export async function scheduleFirstPackageSession(
	page: Page,
	options: { monthOffset?: number; startingDayIndex?: number; timeIndex?: number } = {}
) {
	await openFirstUnscheduledPackageSession(page);
	await pickFirstBookableDateAndTime(
		page,
		options.startingDayIndex ?? 0,
		options.monthOffset ?? 1,
		options.timeIndex ?? 0
	);
	await selectPackageRecordingSpaceIfNeeded(page);
	await page.getByRole("button", { name: "SAVE SESSION" }).click();
	await expect(
		page.getByText("Calendar event created. Check your email for the invitation.")
	).toBeVisible({ timeout: 120_000 });
}

export async function expectFirstPackageSessionScheduled(page: Page, packageSize: number) {
	const sessionsRemaining = packageSize - 1;
	const sessionLabel = sessionsRemaining === 1 ? "session" : "sessions";

	await expect(
		page.getByText(`Schedule ${sessionsRemaining} more ${sessionLabel} to complete your booking.`)
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("Upcoming").first()).toBeVisible();
}
