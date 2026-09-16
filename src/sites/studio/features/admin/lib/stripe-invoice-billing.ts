import type { Doc } from "#convex/_generated/dataModel";
import { formatCustomInvoiceCurrency } from "#studio/features/admin/lib/custom-invoices";

export type StripeInvoiceBillingLink = "invoicePdf" | "receipt";

const stripeInvoiceKindLabels: Record<Doc<"stripeInvoices">["kind"], string> = {
	booking: "Session invoice",
	package: "Package invoice",
	package_adjustment: "Adjustment invoice"
};

export function formatStripeInvoiceKindLabel(kind: Doc<"stripeInvoices">["kind"]) {
	return stripeInvoiceKindLabels[kind];
}

export function formatStripeInvoiceAmount(invoice: Doc<"stripeInvoices">) {
	return formatCustomInvoiceCurrency(invoice.totalAmount);
}

export function getStripeInvoiceAmountClassName(
	paymentStatus: Doc<"stripeInvoices">["paymentStatus"]
) {
	if (paymentStatus === "paid") {
		return "text-green";
	}

	return "text-destructive";
}

export function formatStripeInvoiceBillingLinkLabel(link: StripeInvoiceBillingLink) {
	if (link === "invoicePdf") {
		return "Invoice PDF";
	}

	return "Payment receipt";
}

export function getStripeInvoiceBillingLinks(
	invoice: Doc<"stripeInvoices">
): StripeInvoiceBillingLink[] {
	if (invoice.paymentStatus === "paid") {
		return ["invoicePdf", "receipt"];
	}

	return ["invoicePdf"];
}

type StripeInvoicesQueryResult =
	| undefined
	| readonly [{ reason: string }, null]
	| readonly [null, Doc<"stripeInvoices">[]];

export function getStripeBillingInvoicesState(
	stripeInvoicesResult: StripeInvoicesQueryResult,
	isDialogOpen: boolean
) {
	const stripeInvoices = stripeInvoicesResult?.[1];

	const hasStripeBillingInvoices =
		stripeInvoicesResult !== undefined &&
		stripeInvoicesResult[0] === null &&
		stripeInvoices !== null &&
		stripeInvoices !== undefined &&
		stripeInvoices.length > 0;

	return {
		hasStripeBillingInvoices,
		stripeBillingInvoices:
			isDialogOpen && stripeInvoices !== null && stripeInvoices !== undefined
				? stripeInvoices
				: undefined
	};
}
