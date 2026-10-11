"use node";

import { backfillCheckoutPaymentsOperation } from "#convex/stripe/lib/editInvoiceSendIo";

import {
	quoteRecipientCustomerId,
	cacheOriginalPaymentMutation,
	invoiceDraftTimingArgs,
	savePackageEditDraft,
	loadInvoiceContext,
	type SessionEditContext
} from "#convex/stripe/lib/editInvoiceSendSteps";

import { okAsync, ResultAsync } from "neverthrow";

import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	requirePaidCheckoutAmount,
	requireStripeCustomerEmail,
	retrieveCheckoutSession,
	retrieveStripeCustomer
} from "#convex/stripe/lib/editInvoiceStripe";
import {
	getDraftTarget,
	buildEditInvoiceQuote,
	selectInvoiceTimingDrafts,
	selectDraftsRequiringInvoice,
	splitEditDraftsByKind,
	type EditInvoiceContext,
	type EditInvoiceQuote
} from "#convex/stripe/lib/editInvoiceBilling";
import {
	buildInvoiceRequestId,
	validateConfirmedQuote,
	getConfirmedEditAction,
	selectConfirmedEditSaveDrafts,
	selectConfirmedEditSendRequests,
	validateNoInvoiceRequired,
	type ConfirmEditInvoiceArgs
} from "#convex/stripe/lib/editInvoiceRequest";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import { createAndRecordOptionalEditInvoice } from "#convex/stripe/services/invoiceSend";
import {
	requireEditSessionsPermissionAndLoadBooking,
	loadAdminSessionEditDeps,
	syncAdminBookingGoogleCalendarAndDb,
	notifyHostIfNeeded
} from "#convex/googleCalendar/services/adminUpdate";
import { type AdminSessionUpdateResult } from "#convex/sessions/lib/adminEdit";
import { validateSessionTimingEdit } from "#convex/sessions/services/adminEdit";

function readCheckoutPaidAmount(
	stripeSessionId: string | null
): ResultAsync<number | null, { reason: string }> {
	return retrieveCheckoutSession(stripeSessionId).andThen(requirePaidCheckoutAmount);
}

function loadCheckoutPayment(
	record: Doc<"bookings"> | Doc<"packages">,
	shouldLoadCheckoutPayment: boolean
): ResultAsync<number | null, { reason: string }> {
	const stripeSessionId =
		shouldLoadCheckoutPayment && record.originalPaidAmount === undefined
			? (record.stripeSessionId ?? null)
			: null;

	return readCheckoutPaidAmount(stripeSessionId).map(
		(checkoutPaidAmount) => record.originalPaidAmount ?? checkoutPaidAmount
	);
}

function loadQuoteRecipient(
	draft: EditInvoiceDraft | undefined,
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	const needsCustomerEmail = Boolean(draft) && quote.amount > 0;

	return quoteRecipientCustomerId(needsCustomerEmail, context.record.stripeCustomerId)
		.asyncAndThen(retrieveStripeCustomer)
		.andThen(requireStripeCustomerEmail)
		.map((customerEmail) => (customerEmail === null ? quote : { ...quote, customerEmail }));
}

function cacheCheckoutPayment(ctx: ActionCtx, record: Doc<"bookings"> | Doc<"packages">) {
	return cacheCheckoutPaymentForSession(ctx, record, record.stripeSessionId ?? null);
}

export function backfillCheckoutPayments(
	ctx: ActionCtx,
	args: { table: "bookings" | "packages"; cursor: string | null }
): ResultAsync<
	{ continueCursor: string; isDone: boolean; results: { id: string; reason: string | null }[] },
	{ reason: string }
> {
	return backfillCheckoutPaymentsOperation(ctx, args).andThen((page) =>
		cacheCheckoutPaymentPage(ctx, page)
	);
}

function cacheCheckoutPaymentPage(
	ctx: ActionCtx,
	page: { page: (Doc<"bookings"> | Doc<"packages">)[]; continueCursor: string; isDone: boolean }
) {
	return ResultAsync.combine(page.page.map((record) => cacheCheckoutPayment(ctx, record))).map(
		(results) => ({ continueCursor: page.continueCursor, isDone: page.isDone, results })
	);
}

function loadQuotePayment(
	args: { draft?: EditInvoiceDraft },
	context: EditInvoiceContext
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	const shouldLoadCheckoutPayment = !(args.draft && context.total <= context.currentTotal);

	return loadQuoteFromPayment(args, context, shouldLoadCheckoutPayment);
}

function validateInvoiceTimingFromAction(
	ctx: ActionCtx,
	draft: EditInvoiceDraft | undefined,
	quote: EditInvoiceQuote
) {
	return ResultAsync.combine(
		selectInvoiceTimingDrafts(draft, quote).map((timing) =>
			validateInvoiceTimingQuote(ctx, timing, quote)
		)
	).map(() => quote);
}

export function loadEditInvoicePreviewFromAction(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data")
		.andThen(() => loadInvoiceContext(ctx, args))
		.andThen((context) => loadQuotePayment(args, context))
		.andThen((quote) => validateInvoiceTimingFromAction(ctx, args.draft, quote))
		.map((quote) => ({
			...quote,
			requestId: buildInvoiceRequestId(args.draft, quote, Date.now())
		}));
}

function validateInvoiceDraftTiming(
	ctx: ActionCtx,
	draft: Extract<EditInvoiceDraft, { kind: "booking" }>
) {
	return requireEditSessionsPermissionAndLoadBooking(ctx, draft.values.bookingId)
		.andThen((session) => loadSessionEditContext(ctx, session))
		.andThen((context) => validateSessionTimingEdit(invoiceDraftTimingArgs(draft, context)));
}

function loadSessionEditContext(ctx: ActionCtx, session: Doc<"bookings">) {
	return loadAdminSessionEditDeps(ctx).map((dependencies) => ({ ...dependencies, session }));
}

function saveSessionEditAndNotifyHost(
	ctx: ActionCtx,
	args: Extract<EditInvoiceDraft, { kind: "booking" }>["values"],
	context: SessionEditContext
) {
	return syncAdminBookingGoogleCalendarAndDb({ ctx, args, ...context }).andThen((result) =>
		notifyHostIfNeeded(ctx, args, context.session, context.settings, result)
	);
}

function saveBookingOrPackageChanges(
	ctx: ActionCtx,
	draft: EditInvoiceDraft
): ResultAsync<AdminSessionUpdateResult, { reason: string }> {
	const { bookingDrafts, packageDrafts } = splitEditDraftsByKind(draft);

	return ResultAsync.combine([
		...bookingDrafts.map((bookingDraft) => saveBookingDraft(ctx, bookingDraft)),
		...packageDrafts.map((packageDraft) => savePackageEditDraft(ctx, packageDraft))
	]).map((results) => results[0] ?? {});
}

export function saveNonbillableChanges(
	ctx: ActionCtx,
	draft: EditInvoiceDraft
): ResultAsync<AdminSessionUpdateResult, { reason: string }> {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() => loadInvoiceContext(ctx, { target: getDraftTarget(draft), draft }))
		.andThen((context) => checkEditNeedsNoInvoice(ctx, draft, context))
		.andThen(() => saveBookingOrPackageChanges(ctx, draft));
}

function checkEditNeedsNoInvoice(
	ctx: ActionCtx,
	draft: EditInvoiceDraft,
	context: EditInvoiceContext
) {
	return ResultAsync.combine(
		selectDraftsRequiringInvoice(draft, context.currentTotal, context.total).map((eligibleDraft) =>
			checkEditInvoiceRequirement(ctx, eligibleDraft)
		)
	).map(() => null);
}

function sendQuotedInvoice(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
): ResultAsync<{ stripeInvoiceId: string } | null, { reason: string }> {
	return validateConfirmedQuote(args, quote).asyncAndThen(() =>
		sendInvoiceToBillingTarget(ctx, args, identity, context, quote)
	);
}

function sendInvoiceToBillingTarget(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
) {
	return quoteRecipientCustomerId(true, context.record.stripeCustomerId).asyncAndThen(
		(customerId) =>
			createAndRecordOptionalEditInvoice(
				ctx,
				{ lineItems: quote.lineItems, requestId: args.requestId, target: quote.target },
				identity,
				customerId
			)
	);
}

function saveChangesAfterInvoice(ctx: ActionCtx, draft: EditInvoiceDraft) {
	return saveBookingOrPackageChanges(ctx, draft).mapErr((error) => ({
		...error,
		invoiceSent: true
	}));
}

export function finishConfirmedEdit(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext
): ResultAsync<AdminSessionUpdateResult, { reason: string; invoiceSent?: boolean }> {
	return getConfirmedEditAction(args, context, Date.now()).asyncAndThen((action) =>
		ResultAsync.combine(
			selectConfirmedEditSaveDrafts(action, args.draft).map((draft) =>
				saveChangesAfterInvoice(ctx, draft)
			)
		).andThen((saved) =>
			ResultAsync.combine(
				selectConfirmedEditSendRequests(action, args).map((request) =>
					sendConfirmedEditInvoice(ctx, request, identity, context)
				)
			).map((sent) => sent[0] ?? saved[0] ?? {})
		)
	);
}

export function requireEditInvoicePermissions(ctx: ActionCtx) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		requirePermissionActions(ctx, "send:receipt-emails")
	);
}

export function loadConfirmedEditContext(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string }
): ResultAsync<{ context: EditInvoiceContext; identity: { email?: string } }, { reason: string }> {
	return loadInvoiceContext(ctx, { target: getDraftTarget(args.draft), draft: args.draft }).map(
		(context) => ({ identity, context })
	);
}

function cacheCheckoutPaymentForSession(
	ctx: ActionCtx,
	record: Doc<"bookings"> | Doc<"packages">,
	stripeSessionId: string | null
) {
	return readCheckoutPaidAmount(stripeSessionId)
		.andThen((amount) => cacheOriginalPaymentMutation(ctx, record, stripeSessionId, amount))
		.map(() => ({ id: record._id, reason: stripeSessionId === null ? "NO_STRIPE_SESSION" : null }))
		.orElse((error) => okAsync({ id: record._id, reason: error.reason }));
}

function loadQuoteFromPayment(
	args: { draft?: EditInvoiceDraft },
	context: EditInvoiceContext,
	shouldLoadCheckoutPayment: boolean
) {
	return loadCheckoutPayment(context.record, shouldLoadCheckoutPayment)
		.map((paid) => buildEditInvoiceQuote(context, paid, ""))
		.andThen((quote) => loadQuoteRecipient(args.draft, context, quote));
}

function validateInvoiceTimingQuote(
	ctx: ActionCtx,
	draft: Extract<EditInvoiceDraft, { kind: "booking" }>,
	quote: EditInvoiceQuote
) {
	return validateInvoiceDraftTiming(ctx, draft).map(() => quote);
}

function saveBookingDraft(ctx: ActionCtx, draft: Extract<EditInvoiceDraft, { kind: "booking" }>) {
	return requireEditSessionsPermissionAndLoadBooking(ctx, draft.values.bookingId)
		.andThen((session) => loadSessionEditContext(ctx, session))
		.andThen((context) => saveSessionEditAndNotifyHost(ctx, draft.values, context));
}

function checkEditInvoiceRequirement(ctx: ActionCtx, draft: EditInvoiceDraft) {
	return loadEditInvoicePreviewFromAction(ctx, { target: getDraftTarget(draft), draft }).andThen(
		validateNoInvoiceRequired
	);
}

function sendConfirmedEditInvoice(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext
) {
	return loadEditInvoicePreviewFromAction(ctx, {
		target: getDraftTarget(args.draft),
		draft: args.draft
	})
		.andThen((quote) => sendQuotedInvoice(ctx, args, identity, context, quote))
		.andThen(() => saveChangesAfterInvoice(ctx, args.draft));
}
