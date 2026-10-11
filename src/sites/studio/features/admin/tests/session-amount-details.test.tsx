/**
 * Session amount breakdowns show known checkout, balance, invoice, and total amounts.
 * 1. Invoice totals appear immediately before the total amount.
 * 2. Paid manual balances remain a separate line in the total.
 * 3. Legacy estimates are labeled and identified as unverified.
 * 4. A missing checkout amount keeps the total unavailable when invoices exist.
 * 5. Decimal amounts retain cents in the total.
 * 6. Loaded invoice details show each invoice status and sum their amounts.
 * 7. Loading invoice details keeps the known aggregate amount and total visible.
 * 8. Invoice detail errors keep the known aggregate amount and total visible.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SessionAmountDetails } from "#studio/features/admin/components/SessionAmountPopover";

test("shows invoice total immediately before the total amount", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "unpaid", totalAmount: 100 }}
			showCents={false}
		/>
	);

	expect(html).toContain("Checkout total");
	expect(html).toContain("Invoices total");
	expect(html).toContain("$200");
	expect(html).toContain("$100");
	expect(html).toContain("$300");
	expect(html.indexOf("Invoices total")).toBeLessThan(html.indexOf("Total"));
});

test("includes a paid manual balance as a separate line in the total", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200}
			estimatedPrice={null}
			paidRemainingBalanceAmount={50}
			stripeInvoicesSummary={{ paymentStatus: "paid", totalAmount: 100 }}
			showCents={false}
		/>
	);

	expect(html).toContain("Checkout total");
	expect(html).toContain("Paid manual balance");
	expect(html).toContain("Invoices total");
	expect(html).toContain("Total");
	expect(html).toContain("$50");
	expect(html).toContain("$350");
});

test("labels a legacy estimate and explains that it is unverified", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={null}
			estimatedPrice={328}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "paid", totalAmount: 0 }}
			showCents={false}
		/>
	);

	expect(html).toContain("Estimated booking price");
	expect(html).not.toContain("Checkout total");
	expect(html).toContain("$328");
	expect(html).toContain("Total");
	expect(html).toContain("legacy booking&#x27;s price is estimated using current rates.");
	expect(html).toContain("Its original payment has not been verified.");
});

test("keeps the total unavailable when checkout is unknown even if invoices exist", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={null}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "paid", totalAmount: 100 }}
			showCents={false}
		/>
	);

	expect(html).toContain("Checkout total");
	expect(html).toContain("Invoices total");
	expect(html).toContain("$100");
	expect(html).toContain("Total");
	expect(html).toContain("Unavailable");
});

test("shows cents when checkout and invoice amounts have decimals", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200.25}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "paid", totalAmount: 29.5 }}
			showCents={true}
		/>
	);

	expect(html).toContain("$200.25");
	expect(html).toContain("$29.50");
	expect(html).toContain("$229.75");
	expect(html).toContain("Total");
});

test("shows individual invoices with their status colors and sums their amounts", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "unpaid", totalAmount: 105 }}
			invoiceState={{
				kind: "loaded",
				invoices: [
					{
						stripeInvoiceId: "in_paid_session",
						kind: "booking",
						totalAmount: 80,
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
			showCents={false}
		/>
	);

	expect(html).toContain("Session invoice");
	expect(html).not.toContain("in_paid_session");
	expect(html).toContain("$80.00");
	expect(html).toContain("Adjustment invoice");
	expect(html).not.toContain("in_unpaid_adjustment");
	expect(html).toContain("$25.00");
	expect(html).toMatch(
		/<div class="[^"]*text-green[^"]*"><p[^>]*aria-label="[^"]*paid[^"]*"[^>]*>\$80\.00<\/p>/i
	);
	expect(html).toMatch(
		/<div class="[^"]*text-destructive[^"]*"><p[^>]*aria-label="[^"]*unpaid[^"]*"[^>]*>\$25\.00<\/p>/i
	);
	expect(html).toContain("$305");
	expect(html).not.toMatch(/>Paid<|>Unpaid</);
	expect(html.indexOf("Adjustment invoice")).toBeLessThan(html.indexOf("Invoices total"));
	expect(html.indexOf("Invoices total")).toBeLessThan(html.indexOf("Total"));
	expect(html).toMatch(/Checkout total[\s\S]*?<dd class="[^"]*text-green[^"]*">\$200<\/dd>/);
});

test("shows loading invoice details while keeping the known invoice total", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "unpaid", totalAmount: 75 }}
			invoiceState={{ kind: "loading" }}
			showCents={false}
		/>
	);

	expect(html).toMatch(/loading.{0,30}invoice|invoice.{0,30}loading/i);
	expect(html).toContain("$75");
	expect(html).toContain("$275");
});

test("explains when invoice details cannot load while keeping the known invoice total", () => {
	const html = renderToStaticMarkup(
		<SessionAmountDetails
			checkoutAmount={200}
			estimatedPrice={null}
			paidRemainingBalanceAmount={0}
			stripeInvoicesSummary={{ paymentStatus: "unpaid", totalAmount: 75 }}
			invoiceState={{ kind: "error" }}
			showCents={false}
		/>
	);

	expect(html).toMatch(
		/(?:could not|unable|failed|error).{0,40}invoice|invoice.{0,40}(?:could not|unable|failed|error)/i
	);
	expect(html).toContain("$75");
	expect(html).toContain("$275");
});
