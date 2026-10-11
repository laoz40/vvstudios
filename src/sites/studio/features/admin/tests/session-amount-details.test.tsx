/**
 * Session amount details preserve checkout, balance, invoice, and total values.
 * 1. Known amounts add to the combined total with cents.
 * 2. Unknown checkout amounts keep the total unavailable despite a known invoice.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SessionAmountDetails } from "#studio/features/admin/components/SessionAmountPopover";

test("adds known checkout, manual balance, and invoice amounts with cents", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200.25}
			estimatedPrice={null}
			paidRemainingBalanceAmount={50}
			stripeInvoicesSummary={{ paymentStatus: "unpaid", totalAmount: 105.25 }}
			invoiceState={{
				kind: "loaded",
				invoices: [
					{
						stripeInvoiceId: "in_paid_session",
						kind: "booking",
						totalAmount: 80.25,
						paymentStatus: "paid"
					},
					{
						stripeInvoiceId: "in_unpaid_adjustment",
						kind: "package_adjustment",
						totalAmount: 25,
						paymentStatus: "unpaid"
					}
				]
			}}
			showCents={true}
		/>
	);

	expect(html).toMatch(/Invoices total<\/dt><dd[^>]*>\$105\.25/);
	expect(html).toMatch(/Total<\/dt><dd[^>]*>\$355\.50/);
});

test("keeps the total unavailable when checkout is unknown despite a known invoice", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={null}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "paid", totalAmount: 100 }}
			invoiceState={{ kind: "loading" }}
			showCents={false}
		/>
	);

	expect(html).toMatch(/Invoices total<\/dt><dd[^>]*>\$100/);
	expect(html).toMatch(/Total<\/dt><dd[^>]*>Unavailable/);
});
