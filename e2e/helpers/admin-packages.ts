import { expect, type Page } from "@playwright/test";

export async function confirmPackagePaymentForCustomer(
	page: Page,
	{ customerEmail, customerName }: { customerEmail: string; customerName: string }
) {
	await page.getByRole("tab", { name: "Packages" }).click();
	await page.getByPlaceholder("Search packages...").fill(customerEmail);

	const packageRow = page.getByRole("row").filter({ hasText: customerEmail });
	await expect(packageRow).toBeVisible({ timeout: 30_000 });

	await packageRow.getByRole("button", { name: "Open package actions" }).click();
	await page.getByRole("tab", { name: "Paid", exact: true }).click();

	const dialog = page.getByRole("dialog");
	await expect(
		dialog.getByRole("heading", { name: `Confirm payment for ${customerName}` })
	).toBeVisible();
	await dialog.getByRole("button", { name: "Confirm payment" }).click();
	await expect(page.getByText("Package marked paid and scheduling email sent.")).toBeVisible({
		timeout: 60_000
	});
}
