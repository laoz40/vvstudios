import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { EditInvoiceDraft } from "#convex/services/stripe/editInvoiceValidators";
import type { EditInvoiceTarget } from "#convex/lib/stripe/editInvoiceDb";
import type { EditInvoiceQuote } from "#convex/lib/stripe/editInvoiceBilling";
import { sessionUpdateErrorMessageMap } from "#studio/features/admin/lib/session-edit";

const billingErrors = {
	...sessionUpdateErrorMessageMap,
	INVOICE_CONFIRMATION_REQUIRED: "Review the invoice before saving this increase.",
	STRIPE_CHECKOUT_LOOKUP_FAILED: "Unable to load the original payment. Try again.",
	BILLING_HISTORY_UNAVAILABLE: "The original payment could not be verified.",
	STRIPE_CUSTOMER_LOOKUP_FAILED: "Unable to check the invoice recipient. Try again.",
	STRIPE_CUSTOMER_EMAIL_UNAVAILABLE: "Update the customer's invoice email address in Stripe first.",
	STRIPE_CUSTOMER_NOT_FOUND: "This booking has no Stripe customer. An invoice cannot be sent.",
	BILLING_QUOTE_CHANGED: "Booking or billing details changed. Close and review the edit again.",
	INVOICE_RETRY_REQUIRES_REVIEW:
		"This invoice attempt is too old to retry automatically. Check Stripe before proceeding.",
	STRIPE_INVOICE_FAILED: "Stripe could not send the invoice. Retry to continue the same invoice.",
	NOT_AUTHORIZED: "You do not have access to this operation."
};

function getBillingError(reason: string) {
	return (
		Object.entries(billingErrors).find(([code]) => code === reason)?.[1] ??
		`The operation could not finish (${reason}). Retry to continue.`
	);
}

type InvoiceState =
	| { kind: "closed" }
	| { kind: "checking"; draft: EditInvoiceDraft }
	| { kind: "checkFailed"; draft: EditInvoiceDraft; message: string }
	| {
			kind: "confirm";
			draft: EditInvoiceDraft;
			quote: EditInvoiceQuote;
			hasConfirmed: boolean;
			invoiceSent: boolean;
			message: string | null;
	  }
	| { kind: "sending"; draft: EditInvoiceDraft; quote: EditInvoiceQuote; invoiceSent: boolean };

export function useEditInvoice(target: EditInvoiceTarget, onSaved: () => void) {
	const getQuote = useAction(api.editInvoicing.getQuote);
	const sendInvoice = useAction(api.editInvoicing.saveChangesAndSendInvoice);
	const saveNonbillableDraft = useAction(api.editInvoicing.saveNonbillableDraft);

	const [invoiceState, setInvoiceState] = useState<InvoiceState>({ kind: "closed" });
	const pendingAttempt = useRef<Extract<InvoiceState, { kind: "confirm" }> | null>(null);

	async function reviewInvoice(draft?: EditInvoiceDraft): Promise<boolean> {
		if (invoiceState.kind === "checking" || invoiceState.kind === "sending") return true;
		const values = draft ?? ("draft" in invoiceState ? invoiceState.draft : null);

		if (!values) return true;

		if (pendingAttempt.current) {
			setInvoiceState({
				...pendingAttempt.current,
				message:
					JSON.stringify(values) === JSON.stringify(pendingAttempt.current.draft)
						? pendingAttempt.current.message
						: "Retry the pending invoice before saving a different edit. The original edit is still unsaved."
			});

			return true;
		}

		setInvoiceState({ kind: "checking", draft: values });
		const [failure, quote] = await tryCatch(getQuote({ target, draft: values }));

		if (failure !== null) {
			setInvoiceState({
				kind: "checkFailed",
				draft: values,
				message: getBillingError(failure.reason)
			});

			return true;
		}

		setInvoiceState(
			quote.amount > 0
				? {
						kind: "confirm",
						draft: values,
						quote,
						hasConfirmed: false,
						invoiceSent: false,
						message: null
					}
				: { kind: "closed" }
		);

		return quote.amount > 0;
	}

	async function confirmInvoice() {
		if (invoiceState.kind !== "confirm") return;
		const { draft, quote } = invoiceState;
		setInvoiceState({ kind: "sending", draft, quote, invoiceSent: invoiceState.invoiceSent });

		const [failure] = await tryCatch(
			sendInvoice({
				draft,
				requestId: quote.requestId,
				revision: quote.revision,
				total: quote.total,
				amount: quote.amount
			})
		);

		if (failure !== null) {
			const invoiceSent = "invoiceSent" in failure && failure.invoiceSent;

			const progress = invoiceSent
				? "The invoice was sent, but the edit was not saved. Retry saving without sending another invoice."
				: "The edit has not been saved.";

			const failedAttempt: Extract<InvoiceState, { kind: "confirm" }> = {
				kind: "confirm",
				draft,
				quote,
				hasConfirmed: failure.reason !== "BILLING_QUOTE_CHANGED" || !!invoiceSent,
				invoiceSent: !!invoiceSent,
				message: progress + " " + getBillingError(failure.reason)
			};

			pendingAttempt.current =
				!invoiceSent &&
				(failure.reason === "STRIPE_INVOICE_FAILED" || failure.reason === "UNEXPECTED_ERROR")
					? failedAttempt
					: null;
			setInvoiceState(failedAttempt);

			return;
		}

		setInvoiceState({ kind: "closed" });
		pendingAttempt.current = null;
		onSaved();
		toast.success("Changes saved and Stripe invoice sent.");
	}

	async function saveNonbillable(draft: EditInvoiceDraft) {
		const [failure, result] = await tryCatch(saveNonbillableDraft({ draft }));

		if (failure !== null) {
			toast.error(getBillingError(failure.reason));

			return;
		}

		onSaved();

		if (result.googleOutcome === "replacementCreated") {
			toast.success("Booking updated. Replacement Calendar event created.");

			return;
		}

		toast.success(draft.kind === "package" ? "Package updated." : "Booking updated.");
	}

	const hasConfirmed =
		invoiceState.kind === "sending" ||
		(invoiceState.kind === "confirm" && invoiceState.hasConfirmed);

	return {
		hasConfirmed,
		invoiceSent: "invoiceSent" in invoiceState && invoiceState.invoiceSent,
		quote: "quote" in invoiceState ? invoiceState.quote : null,
		open: invoiceState.kind !== "closed",
		isLoading: invoiceState.kind === "checking",
		isSending: invoiceState.kind === "sending",
		error: "message" in invoiceState ? invoiceState.message : null,
		reviewInvoice,
		confirmInvoice,
		saveNonbillable,
		close: () => {
			if (invoiceState.kind !== "sending" && invoiceState.kind !== "checking")
				setInvoiceState({ kind: "closed" });
		}
	};
}
