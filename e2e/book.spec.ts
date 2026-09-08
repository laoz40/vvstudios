import { expect, test } from "@playwright/test";
import {
	expectTermsDialog,
	fillSingleSessionBookingForm,
	submitBookingForm
} from "./helpers/booking-form";

test.describe("book page", () => {
	test("loads booking form sections", async ({ page }) => {
		await page.goto("/book");

		await expect(page.getByRole("heading", { name: "Studio Hire Booking" })).toBeVisible();
		await expect(page.getByText("Booking Type *")).toBeVisible();
		await expect(page.getByText("Session Duration *")).toBeVisible();
		await expect(page.getByText("Contact Details")).toBeVisible();
		await expect(page.getByText("Session Date *")).toBeVisible();
	});

	test("single session form opens terms dialog", async ({ page }) => {
		test.setTimeout(60_000);

		await page.goto("/book");

		await fillSingleSessionBookingForm(page);
		await submitBookingForm(page);
		await expectTermsDialog(page);
	});
});
