"use node";

import { createHash } from "node:crypto";
import { err, ok, type Result } from "neverthrow";
import type { EditInvoiceDraft } from "#convex/services/stripe/editInvoiceValidators";
import type { EditInvoiceContext, EditInvoiceQuote } from "#convex/lib/stripe/editInvoiceBilling";

export type ConfirmEditInvoiceArgs = {
	draft: EditInvoiceDraft;
	requestId: string;
	revision: string;
	total: number;
	amount: number;
};

export function buildInvoiceRequestId(
	draft: EditInvoiceDraft | undefined,
	quote: Pick<EditInvoiceQuote, "revision" | "total" | "amount">,
	timestamp: number
) {
	const hash = createHash("sha256")
		.update(JSON.stringify([draft, quote.revision, quote.total, quote.amount]))
		.digest("hex");

	return timestamp + ":" + hash;
}

export function validateConfirmedQuote(args: ConfirmEditInvoiceArgs, quote: EditInvoiceQuote) {
	if (quote.revision !== args.revision) return err({ reason: "BILLING_QUOTE_CHANGED" });

	if (quote.total !== args.total) return err({ reason: "BILLING_QUOTE_CHANGED" });

	if (quote.amount !== args.amount || quote.amount <= 0)
		return err({ reason: "BILLING_QUOTE_CHANGED" });

	return ok(null);
}

export function getConfirmedEditAction(
	args: ConfirmEditInvoiceArgs,
	context: EditInvoiceContext,
	now: number
): Result<"complete" | "save" | "send", { reason: string; invoiceSent?: boolean }> {
	const timestamp = Number(args.requestId.split(":")[0]);

	if (!Number.isFinite(timestamp) || timestamp > now)
		return err({ reason: "BILLING_QUOTE_CHANGED" });

	if (args.requestId !== buildInvoiceRequestId(args.draft, args, timestamp)) {
		return err({ reason: "BILLING_QUOTE_CHANGED" });
	}

	const existing = context.invoices.find((invoice) => invoice.requestId === args.requestId);

	if (existing && existing.totalAmount === args.amount && context.alreadySaved)
		return ok("complete");

	if (context.revision !== args.revision || context.total !== args.total) {
		return err({ reason: "BILLING_QUOTE_CHANGED", invoiceSent: !!existing });
	}

	if (existing) return ok("save");

	// Stripe only retains idempotency keys for 24 hours. Never recreate an uncertain old request.
	if (now - timestamp >= 23 * 60 * 60 * 1000)
		return err({ reason: "INVOICE_RETRY_REQUIRES_REVIEW" });

	return ok("send");
}

export function validateNoInvoiceRequired(quote: EditInvoiceQuote) {
	if (quote.amount > 0) return err({ reason: "INVOICE_CONFIRMATION_REQUIRED" });

	return ok(null);
}
