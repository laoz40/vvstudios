import { exhaustiveCheck } from "#/lib/result";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import type { EditInvoiceQuote } from "#convex/stripe/lib/editInvoiceBilling";
import { sessionUpdateErrorMessageMap } from "#studio/features/admin/lib/session-edit";

export type AdminEditConfirmationWarnings = {
	primaryFieldLabels: string[];
	driveIdentityFieldLabels: string[];
	pricingFieldLabels: string[];
};

export type AdminEditPendingInvoiceAttempt<TDraft extends EditInvoiceDraft = EditInvoiceDraft> = {
	draft: TDraft;
	warnings: AdminEditConfirmationWarnings;
	quote: EditInvoiceQuote;
	hasConfirmed: boolean;
	invoiceSent: boolean;
	error: string;
};

export type AdminEditPhase<TDraft extends EditInvoiceDraft = EditInvoiceDraft> =
	| { kind: "idle" }
	| { kind: "savingDirect" }
	| { kind: "checkingInvoice"; draft: TDraft; warnings: AdminEditConfirmationWarnings }
	| {
			kind: "invoiceCheckFailed";
			draft: TDraft;
			warnings: AdminEditConfirmationWarnings;
			error: string;
	  }
	| { kind: "readyToConfirm"; draft: TDraft; warnings: AdminEditConfirmationWarnings }
	| { kind: "savingConfirmed"; draft: TDraft; warnings: AdminEditConfirmationWarnings }
	| {
			kind: "invoiceConfirm";
			draft: TDraft;
			warnings: AdminEditConfirmationWarnings;
			quote: EditInvoiceQuote;
			hasConfirmed: boolean;
			invoiceSent: boolean;
			error: string | null;
	  }
	| {
			kind: "sendingInvoice";
			draft: TDraft;
			warnings: AdminEditConfirmationWarnings;
			quote: EditInvoiceQuote;
			invoiceSent: boolean;
	  };

export type AdminEditState<TDraft extends EditInvoiceDraft = EditInvoiceDraft> = {
	isEditDialogOpen: boolean;
	phase: AdminEditPhase<TDraft>;
	pendingInvoiceAttempt: AdminEditPendingInvoiceAttempt<TDraft> | null;
};

export type AdminEditEvent<TDraft extends EditInvoiceDraft = EditInvoiceDraft> =
	| { type: "editDialogChanged"; open: boolean }
	| { type: "directSaveStarted" }
	| { type: "confirmationOpened"; draft: TDraft; warnings: AdminEditConfirmationWarnings }
	| { type: "invoiceCheckStarted"; draft: TDraft; warnings: AdminEditConfirmationWarnings }
	| { type: "invoiceCheckFailed"; error: string }
	| { type: "invoiceQuoteLoaded"; quote: EditInvoiceQuote }
	| { type: "reopenPendingInvoiceAttempt"; submittedDraft: TDraft }
	| { type: "confirmSaveStarted" }
	| { type: "invoiceSendStarted" }
	| { type: "invoiceSendFailed"; reason: string; invoiceSent: boolean }
	| { type: "invoiceSendSucceeded" }
	| { type: "saveSucceeded" }
	| { type: "saveFailed" }
	| { type: "confirmationDismissed" };

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

export function getBillingError(reason: string) {
	return (
		Object.entries(billingErrors).find(([code]) => code === reason)?.[1] ??
		`The operation could not finish (${reason}). Retry to continue.`
	);
}

export function createInitialAdminEditState<
	TDraft extends EditInvoiceDraft
>(): AdminEditState<TDraft> {
	return { isEditDialogOpen: false, phase: { kind: "idle" }, pendingInvoiceAttempt: null };
}

export function isAdminEditConfirmationOpen(phase: AdminEditPhase): boolean {
	switch (phase.kind) {
		case "idle":
		case "savingDirect":
			return false;
		case "checkingInvoice":
		case "invoiceCheckFailed":
		case "readyToConfirm":
		case "savingConfirmed":
		case "invoiceConfirm":
		case "sendingInvoice":
			return true;
		default:
			return exhaustiveCheck(phase);
	}
}

export function isAdminEditPhaseBusy(phase: AdminEditPhase): boolean {
	switch (phase.kind) {
		case "savingDirect":
		case "checkingInvoice":
		case "savingConfirmed":
		case "sendingInvoice":
			return true;
		case "idle":
		case "invoiceCheckFailed":
		case "readyToConfirm":
		case "invoiceConfirm":
			return false;
		default:
			return exhaustiveCheck(phase);
	}
}

function reduceInvoiceQuoteLoaded<TDraft extends EditInvoiceDraft>(
	state: AdminEditState<TDraft>,
	quote: EditInvoiceQuote
): AdminEditState<TDraft> {
	if (state.phase.kind !== "checkingInvoice") {
		return state;
	}

	const nextPhase: AdminEditPhase<TDraft> =
		quote.amount > 0
			? {
					kind: "invoiceConfirm",
					draft: state.phase.draft,
					warnings: state.phase.warnings,
					quote,
					hasConfirmed: false,
					invoiceSent: false,
					error: null
				}
			: { kind: "readyToConfirm", draft: state.phase.draft, warnings: state.phase.warnings };

	return { ...state, phase: nextPhase };
}

function reduceReopenPendingInvoiceAttempt<TDraft extends EditInvoiceDraft>(
	state: AdminEditState<TDraft>,
	submittedDraft: TDraft
): AdminEditState<TDraft> {
	const pending = state.pendingInvoiceAttempt;

	if (!pending) {
		return state;
	}

	const isSameDraft = JSON.stringify(submittedDraft) === JSON.stringify(pending.draft);

	return {
		...state,
		phase: {
			kind: "invoiceConfirm",
			draft: pending.draft,
			warnings: pending.warnings,
			quote: pending.quote,
			hasConfirmed: pending.hasConfirmed,
			invoiceSent: pending.invoiceSent,
			error: isSameDraft
				? pending.error
				: "Retry the pending invoice before saving a different edit. The original edit is still unsaved."
		}
	};
}

function reduceInvoiceSendFailed<TDraft extends EditInvoiceDraft>(
	state: AdminEditState<TDraft>,
	reason: string,
	invoiceSent: boolean
): AdminEditState<TDraft> {
	if (state.phase.kind !== "sendingInvoice") {
		return state;
	}

	const progress = invoiceSent
		? "The invoice was sent, but the edit was not saved. Retry saving without sending another invoice."
		: "The edit has not been saved.";

	const error = `${progress} ${getBillingError(reason)}`;
	const hasConfirmed = reason !== "BILLING_QUOTE_CHANGED" || invoiceSent;

	const isRetryableInvoiceFailure =
		!invoiceSent && (reason === "STRIPE_INVOICE_FAILED" || reason === "UNEXPECTED_ERROR");

	const failedConfirm: Extract<AdminEditPhase<TDraft>, { kind: "invoiceConfirm" }> = {
		kind: "invoiceConfirm",
		draft: state.phase.draft,
		warnings: state.phase.warnings,
		quote: state.phase.quote,
		hasConfirmed,
		invoiceSent,
		error
	};

	const pendingInvoiceAttempt: AdminEditPendingInvoiceAttempt<TDraft> | null =
		isRetryableInvoiceFailure
			? {
					draft: state.phase.draft,
					warnings: state.phase.warnings,
					quote: state.phase.quote,
					hasConfirmed,
					invoiceSent: false,
					error
				}
			: null;

	return { ...state, phase: failedConfirm, pendingInvoiceAttempt };
}

type AdminEditInvoiceEvent<TDraft extends EditInvoiceDraft> = Extract<
	AdminEditEvent<TDraft>,
	{
		type:
			| "invoiceCheckStarted"
			| "invoiceCheckFailed"
			| "invoiceQuoteLoaded"
			| "reopenPendingInvoiceAttempt"
			| "invoiceSendStarted"
			| "invoiceSendFailed"
			| "invoiceSendSucceeded";
	}
>;

function isAdminEditInvoiceEvent<TDraft extends EditInvoiceDraft>(
	event: AdminEditEvent<TDraft>
): event is AdminEditInvoiceEvent<TDraft> {
	switch (event.type) {
		case "invoiceCheckStarted":
		case "invoiceCheckFailed":
		case "invoiceQuoteLoaded":
		case "reopenPendingInvoiceAttempt":
		case "invoiceSendStarted":
		case "invoiceSendFailed":
		case "invoiceSendSucceeded":
			return true;
		case "editDialogChanged":
		case "directSaveStarted":
		case "confirmationOpened":
		case "confirmSaveStarted":
		case "saveSucceeded":
		case "saveFailed":
		case "confirmationDismissed":
			return false;
		default:
			return exhaustiveCheck(event);
	}
}

function reduceAdminEditInvoiceEvent<TDraft extends EditInvoiceDraft>(
	state: AdminEditState<TDraft>,
	event: AdminEditInvoiceEvent<TDraft>
): AdminEditState<TDraft> {
	switch (event.type) {
		case "invoiceCheckStarted":
			return {
				...state,
				phase: { kind: "checkingInvoice", draft: event.draft, warnings: event.warnings }
			};
		case "invoiceCheckFailed":
			return state.phase.kind === "checkingInvoice"
				? {
						...state,
						phase: {
							kind: "invoiceCheckFailed",
							draft: state.phase.draft,
							warnings: state.phase.warnings,
							error: event.error
						}
					}
				: state;
		case "invoiceQuoteLoaded":
			return reduceInvoiceQuoteLoaded(state, event.quote);
		case "reopenPendingInvoiceAttempt":
			return reduceReopenPendingInvoiceAttempt(state, event.submittedDraft);
		case "invoiceSendStarted":
			return state.phase.kind === "invoiceConfirm"
				? {
						...state,
						phase: {
							kind: "sendingInvoice",
							draft: state.phase.draft,
							warnings: state.phase.warnings,
							quote: state.phase.quote,
							invoiceSent: state.phase.invoiceSent
						}
					}
				: state;
		case "invoiceSendFailed":
			return reduceInvoiceSendFailed(state, event.reason, event.invoiceSent);
		case "invoiceSendSucceeded":
			return {
				...state,
				isEditDialogOpen: false,
				phase: { kind: "idle" },
				pendingInvoiceAttempt: null
			};
		default:
			return exhaustiveCheck(event);
	}
}

export function reduceAdminEdit<TDraft extends EditInvoiceDraft>(
	state: AdminEditState<TDraft>,
	event: AdminEditEvent<TDraft>
): AdminEditState<TDraft> {
	if (isAdminEditInvoiceEvent(event)) {
		return reduceAdminEditInvoiceEvent(state, event);
	}

	switch (event.type) {
		case "editDialogChanged":
			return !event.open && state.phase.kind !== "idle"
				? state
				: { ...state, isEditDialogOpen: event.open };
		case "directSaveStarted":
			return { ...state, phase: { kind: "savingDirect" } };
		case "confirmationOpened":
			return {
				...state,
				phase: { kind: "readyToConfirm", draft: event.draft, warnings: event.warnings }
			};
		case "confirmSaveStarted":
			return state.phase.kind === "readyToConfirm"
				? {
						...state,
						phase: {
							kind: "savingConfirmed",
							draft: state.phase.draft,
							warnings: state.phase.warnings
						}
					}
				: state;
		case "saveSucceeded":
			return { ...state, isEditDialogOpen: false, phase: { kind: "idle" } };
		case "saveFailed":
			return { ...state, phase: { kind: "idle" } };
		case "confirmationDismissed":
			return isAdminEditPhaseBusy(state.phase) ? state : { ...state, phase: { kind: "idle" } };
		default:
			return exhaustiveCheck(event);
	}
}
