/**
 * Payment summaries display verified money separately from edited totals.
 * 1. Loaded payments show the amount paid.
 * 2. Unknown payments display an unavailable status.
 * 3. The paid amount remains visible when it equals the current total.
 * 4. The invoice preview shows additions and adjustments with one invoice total.
 * 5. Pending payments show a loading status.
 * 6. Changed totals show the previous and new amounts on one line.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
	EditPaymentSummary,
	EditPriceSummary
} from "#studio/features/admin/components/EditPaymentSummary";
import { EditInvoicePreview } from "#studio/features/admin/components/EditInvoicePreview";

test("shows verified payment when the total changes", () => {
	const html = renderToStaticMarkup(<EditPaymentSummary summary={{ paidAmount: 200 }} />);

	expect(html).toContain("Paid:");
	expect(html).toContain("$200");
});

test("shows when the paid amount is unavailable", () => {
	expect(renderToStaticMarkup(<EditPaymentSummary summary={{ paidAmount: null }} />)).toContain(
		"Unavailable"
	);
});

test("keeps the loaded paid amount visible", () => {
	expect(renderToStaticMarkup(<EditPaymentSummary summary={{ paidAmount: 200 }} />)).toContain(
		"$200"
	);
});

test("previews the invoice items and one total without the booking totals", () => {
	const html = renderToStaticMarkup(
		<EditInvoicePreview
			quote={{
				lineItems: [
					{ description: "Rough Cut x2", amount: 200 },
					{ description: "Credits and pricing adjustments", amount: -29 }
				],
				amount: 171
			}}
		/>
	);

	expect(html).toContain("Rough Cut x2");
	expect(html).toContain("$200");
	expect(html).toContain("-$29");
	expect(html).toContain("Invoice total");
	expect(html).toContain("$171");
	expect(html).not.toMatch(/Current total|New total|Difference|Paid:/);
});

test("shows a loading status until the paid amount is available", () => {
	const html = renderToStaticMarkup(<EditPaymentSummary />);

	expect(html).toContain('role="status"');
	expect(html).toContain("Paid:");
	expect(html).toContain("Loading");
});

test("shows a changed total in one field with the previous amount and difference", () => {
	const html = renderToStaticMarkup(
		<EditPriceSummary
			currentTotal={200}
			newTotal={299}
			summary={{ paidAmount: 200 }}
		/>
	);

	expect(html).toContain("New total:");
	expect(html).toContain("$200");
	expect(html).toContain("→");
	expect(html).toContain("$299");
	expect(html).toContain("(+$99)");
	expect(html).not.toMatch(/Current total:|Previous total:/);
});
