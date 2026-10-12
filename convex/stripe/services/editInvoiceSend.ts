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

import { okAsync, ResultAsync, ok, safeTry } from "neverthrow";

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
import type { AdminSessionUpdateResult } from "#convex/sessions/lib/adminEdit";
import { validateSessionTimingEdit } from "#convex/sessions/services/adminEdit";

function readCheckoutPaidAmount(stripeSessionId: string | null) {
	return safeTry(async function* () {
		const checkoutSession = yield* retrieveCheckoutSession(stripeSessionId);
		const paidAmount = yield* requirePaidCheckoutAmount(checkoutSession);

		return ok(paidAmount);
	});
}

function loadCheckoutPayment(
	record: Doc<"bookings"> | Doc<"packages">,
	shouldLoadCheckoutPayment: boolean
) {
	const stripeSessionId =
		shouldLoadCheckoutPayment && record.originalPaidAmount === undefined
			? (record.stripeSessionId ?? null)
			: null;

	return safeTry(async function* () {
		const paidAmount = yield* readCheckoutPaidAmount(stripeSessionId);

		return ok(record.originalPaidAmount ?? paidAmount);
	});
}

function loadQuoteRecipient(
	draft: EditInvoiceDraft | undefined,
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
) {
	const needsCustomerEmail = Boolean(draft) && quote.amount > 0;

	return safeTry(async function* () {
		const customerId = yield* quoteRecipientCustomerId(
			needsCustomerEmail,
			context.record.stripeCustomerId
		);

		const customer = yield* retrieveStripeCustomer(customerId);
		const customerEmail = yield* requireStripeCustomerEmail(customer);

		const recipientQuote =
			customerEmail === null ? quote : { ...quote, customerEmail: customerEmail };

		return ok(recipientQuote);
	});
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
	return safeTry(async function* () {
		const page = yield* backfillCheckoutPaymentsOperation(ctx, args);
		const result = yield* cacheCheckoutPaymentPage(ctx, page);

		return ok(result);
	});
}

function cacheCheckoutPaymentPage(
	ctx: ActionCtx,
	page: { page: (Doc<"bookings"> | Doc<"packages">)[]; continueCursor: string; isDone: boolean }
) {
	return safeTry(async function* () {
		const results = yield* ResultAsync.combine(
			page.page.map((record) => cacheCheckoutPayment(ctx, record))
		);

		return ok({ continueCursor: page.continueCursor, isDone: page.isDone, results: results });
	});
}

function loadQuotePayment(args: { draft?: EditInvoiceDraft }, context: EditInvoiceContext) {
	const shouldLoadCheckoutPayment = !(args.draft && context.total <= context.currentTotal);

	return loadQuoteFromPayment(args, context, shouldLoadCheckoutPayment);
}

function validateInvoiceTimingFromAction(
	ctx: ActionCtx,
	draft: EditInvoiceDraft | undefined,
	quote: EditInvoiceQuote
) {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			selectInvoiceTimingDrafts(draft, quote).map((timing) =>
				validateInvoiceTimingQuote(ctx, timing, quote)
			)
		);

		return ok(quote);
	});
}

export function loadEditInvoicePreviewFromAction(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "view:sensitive-booking-data");
		const context = yield* loadInvoiceContext(ctx, args);
		const quote = yield* loadQuotePayment(args, context);
		const validatedQuote = yield* validateInvoiceTimingFromAction(ctx, args.draft, quote);

		return ok({
			...validatedQuote,
			requestId: buildInvoiceRequestId(args.draft, validatedQuote, Date.now())
		});
	});
}

function validateInvoiceDraftTiming(
	ctx: ActionCtx,
	draft: Extract<EditInvoiceDraft, { kind: "booking" }>
) {
	return safeTry(async function* () {
		const session = yield* requireEditSessionsPermissionAndLoadBooking(ctx, draft.values.bookingId);
		const context = yield* loadSessionEditContext(ctx, session);
		const timing = yield* validateSessionTimingEdit(invoiceDraftTimingArgs(draft, context));

		return ok(timing);
	});
}

function loadSessionEditContext(ctx: ActionCtx, session: Doc<"bookings">) {
	return safeTry(async function* () {
		const dependencies = yield* loadAdminSessionEditDeps(ctx);

		return ok({ ...dependencies, session });
	});
}

function saveSessionEditAndNotifyHost(
	ctx: ActionCtx,
	args: Extract<EditInvoiceDraft, { kind: "booking" }>["values"],
	context: SessionEditContext
) {
	return safeTry(async function* () {
		const result = yield* syncAdminBookingGoogleCalendarAndDb({ ctx, args, ...context });

		const notifiedResult = yield* notifyHostIfNeeded(
			ctx,
			args,
			context.session,
			context.settings,
			result
		);

		return ok(notifiedResult);
	});
}

function saveBookingOrPackageChanges(ctx: ActionCtx, draft: EditInvoiceDraft) {
	const { bookingDrafts, packageDrafts } = splitEditDraftsByKind(draft);

	return safeTry(async function* () {
		const results = yield* ResultAsync.combine([
			...bookingDrafts.map((bookingDraft) => saveBookingDraft(ctx, bookingDraft)),
			...packageDrafts.map((packageDraft) => savePackageEditDraft(ctx, packageDraft))
		]);

		return ok(results[0] ?? {});
	});
}

export function saveNonbillableChanges(
	ctx: ActionCtx,
	draft: EditInvoiceDraft
): ResultAsync<AdminSessionUpdateResult, { reason: string }> {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "edit:sessions");
		const context = yield* loadInvoiceContext(ctx, { target: getDraftTarget(draft), draft });
		yield* checkEditNeedsNoInvoice(ctx, draft, context);
		const result = yield* saveBookingOrPackageChanges(ctx, draft);

		return ok(result);
	});
}

function checkEditNeedsNoInvoice(
	ctx: ActionCtx,
	draft: EditInvoiceDraft,
	context: EditInvoiceContext
) {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			selectDraftsRequiringInvoice(draft, context.currentTotal, context.total).map(
				(eligibleDraft) => checkEditInvoiceRequirement(ctx, eligibleDraft)
			)
		);

		return ok(null);
	});
}

function sendQuotedInvoice(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
) {
	return safeTry(async function* () {
		yield* validateConfirmedQuote(args, quote);
		const invoice = yield* sendInvoiceToBillingTarget(ctx, args, identity, context, quote);

		return ok(invoice);
	});
}

function sendInvoiceToBillingTarget(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
) {
	return safeTry(async function* () {
		const customerId = yield* quoteRecipientCustomerId(true, context.record.stripeCustomerId);

		const invoice = yield* createAndRecordOptionalEditInvoice(
			ctx,
			{ lineItems: quote.lineItems, requestId: args.requestId, target: quote.target },
			identity,
			customerId
		);

		return ok(invoice);
	});
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
	return safeTry(async function* () {
		const action = yield* getConfirmedEditAction(args, context, Date.now());

		const saved = yield* ResultAsync.combine(
			selectConfirmedEditSaveDrafts(action, args.draft).map((draft) =>
				saveChangesAfterInvoice(ctx, draft)
			)
		);

		const sent = yield* ResultAsync.combine(
			selectConfirmedEditSendRequests(action, args).map((request) =>
				sendConfirmedEditInvoice(ctx, request, identity, context)
			)
		);

		return ok(sent[0] ?? saved[0] ?? {});
	});
}

export function requireEditInvoicePermissions(ctx: ActionCtx) {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "edit:sessions");
		const identity = yield* requirePermissionActions(ctx, "send:receipt-emails");

		return ok(identity);
	});
}

export function loadConfirmedEditContext(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string }
): ResultAsync<{ context: EditInvoiceContext; identity: { email?: string } }, { reason: string }> {
	return safeTry(async function* () {
		const context = yield* loadInvoiceContext(ctx, {
			target: getDraftTarget(args.draft),
			draft: args.draft
		});

		return ok({ identity, context });
	});
}

function cacheCheckoutPaymentForSession(
	ctx: ActionCtx,
	record: Doc<"bookings"> | Doc<"packages">,
	stripeSessionId: string | null
) {
	return safeTry(async function* () {
		const paidAmount = yield* readCheckoutPaidAmount(stripeSessionId);
		yield* cacheOriginalPaymentMutation(ctx, record, stripeSessionId, paidAmount);

		return ok({ id: record._id, reason: stripeSessionId === null ? "NO_STRIPE_SESSION" : null });
	}).orElse((error) => okAsync({ id: record._id, reason: error.reason }));
}

function loadQuoteFromPayment(
	args: { draft?: EditInvoiceDraft },
	context: EditInvoiceContext,
	shouldLoadCheckoutPayment: boolean
) {
	return safeTry(async function* () {
		const paidAmount = yield* loadCheckoutPayment(context.record, shouldLoadCheckoutPayment);
		const quote = buildEditInvoiceQuote(context, paidAmount, "");
		const recipientQuote = yield* loadQuoteRecipient(args.draft, context, quote);

		return ok(recipientQuote);
	});
}

function validateInvoiceTimingQuote(
	ctx: ActionCtx,
	draft: Extract<EditInvoiceDraft, { kind: "booking" }>,
	quote: EditInvoiceQuote
) {
	return safeTry(async function* () {
		yield* validateInvoiceDraftTiming(ctx, draft);

		return ok(quote);
	});
}

function saveBookingDraft(ctx: ActionCtx, draft: Extract<EditInvoiceDraft, { kind: "booking" }>) {
	return safeTry(async function* () {
		const session = yield* requireEditSessionsPermissionAndLoadBooking(ctx, draft.values.bookingId);
		const context = yield* loadSessionEditContext(ctx, session);
		const result = yield* saveSessionEditAndNotifyHost(ctx, draft.values, context);

		return ok(result);
	});
}

function checkEditInvoiceRequirement(ctx: ActionCtx, draft: EditInvoiceDraft) {
	return safeTry(async function* () {
		const quote = yield* loadEditInvoicePreviewFromAction(ctx, {
			target: getDraftTarget(draft),
			draft
		});

		const requirement = yield* validateNoInvoiceRequired(quote);

		return ok(requirement);
	});
}

function sendConfirmedEditInvoice(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext
) {
	return safeTry(async function* () {
		const quote = yield* loadEditInvoicePreviewFromAction(ctx, {
			target: getDraftTarget(args.draft),
			draft: args.draft
		});

		yield* sendQuotedInvoice(ctx, args, identity, context, quote);
		const result = yield* saveChangesAfterInvoice(ctx, args.draft);

		return ok(result);
	});
}
