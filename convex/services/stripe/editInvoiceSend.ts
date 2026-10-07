"use node";

import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import {
	readCheckoutPaidAmount,
	loadCheckoutPayment,
	loadQuoteRecipient
} from "#convex/lib/stripe/editInvoiceStripe";
import {
	buildEditInvoiceQuote,
	getDraftTarget,
	getInvoiceTimingDraft,
	type EditInvoiceContext,
	type EditInvoiceQuote
} from "#convex/lib/stripe/editInvoiceBilling";
import {
	buildInvoiceRequestId,
	validateConfirmedQuote,
	getConfirmedEditAction,
	validateNoInvoiceRequired,
	type ConfirmEditInvoiceArgs
} from "#convex/lib/stripe/editInvoiceRequest";
import type { EditInvoiceTarget } from "#convex/lib/stripe/editInvoiceDb";
import type { EditInvoiceDraft } from "#convex/services/stripe/editInvoiceValidators";
import {
	createAndRecordBookingStripeInvoice,
	createAndRecordPackageStripeInvoice
} from "#convex/services/stripe/stripeInvoiceSend";
import {
	requireEditSessionsPermissionAndLoadBooking,
	loadAdminSessionEditDeps,
	syncAdminBookingGoogleCalendarAndDb,
	notifyHostIfNeeded
} from "#convex/services/googleCalendar/sessionAdminUpdate";
import {
	validateSessionTimingEdit,
	type AdminSessionUpdateResult
} from "#convex/lib/sessions/sessionAdminEdit";

function cacheCheckoutPayment(ctx: ActionCtx, record: Doc<"bookings"> | Doc<"packages">) {
	if (!record.stripeSessionId) return okAsync({ id: record._id, reason: "NO_STRIPE_SESSION" });

	const stripeSessionId = record.stripeSessionId;

	const target: EditInvoiceTarget =
		"packageSize" in record
			? { kind: "package", packageId: record._id }
			: { kind: "booking", bookingId: record._id };

	return readCheckoutPaidAmount(stripeSessionId)
		.andThen((amount) =>
			fromConvexTuple(
				ctx.runMutation(internal.editInvoices.cacheOriginalPayment, {
					target,
					amount,
					stripeSessionId
				})
			)
		)
		.map(() => ({ id: record._id, reason: null }))
		.orElse((error) => okAsync({ id: record._id, reason: error.reason }));
}

export function backfillCheckoutPayments(
	ctx: ActionCtx,
	args: { table: "bookings" | "packages"; cursor: string | null }
): ResultAsync<
	{ continueCursor: string; isDone: boolean; results: { id: string; reason: string | null }[] },
	{ reason: string }
> {
	return fromConvexTuple(ctx.runQuery(internal.editInvoices.getMissingPayments, args)).andThen(
		(page) =>
			ResultAsync.combine(page.page.map((record) => cacheCheckoutPayment(ctx, record))).map(
				(results) => ({ continueCursor: page.continueCursor, isDone: page.isDone, results })
			)
	);
}

function loadQuotePayment(
	args: { draft?: EditInvoiceDraft },
	context: EditInvoiceContext
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	if (args.draft && context.total <= context.currentTotal)
		return okAsync(buildEditInvoiceQuote(context, context.record.originalPaidAmount ?? null, ""));

	return loadCheckoutPayment(context.record)
		.map((paid) => buildEditInvoiceQuote(context, paid, ""))
		.andThen((quote) => loadQuoteRecipient(args.draft, context, quote));
}

function validateInvoiceTimingFromAction(
	ctx: ActionCtx,
	draft: EditInvoiceDraft | undefined,
	quote: EditInvoiceQuote
) {
	const timingDraft = getInvoiceTimingDraft(draft, quote);

	if (!timingDraft) return okAsync(quote);

	return validateInvoiceDraftTiming(ctx, timingDraft).map(() => quote);
}

export function loadEditInvoicePreviewFromAction(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
): ResultAsync<EditInvoiceQuote, { reason: string }> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data")
		.andThen(() => fromConvexTuple(ctx.runQuery(internal.editInvoices.getContext, args)))
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
	return requireEditSessionsPermissionAndLoadBooking(ctx, draft.values.bookingId).andThen(
		(session) =>
			loadAdminSessionEditDeps(ctx).andThen(({ client, settings }) =>
				validateSessionTimingEdit({
					bypassAvailabilitySettings: session.status !== "failed",
					calendar: client.calendar,
					calendarIds: client.calendarIds,
					existing: session,
					next: draft.values,
					settings,
					timeZone: client.timeZone
				})
			)
	);
}

function saveBookingOrPackageChanges(
	ctx: ActionCtx,
	draft: EditInvoiceDraft
): ResultAsync<AdminSessionUpdateResult, { reason: string }> {
	if (draft.kind === "package")
		return fromConvexTuple(ctx.runMutation(api.packages.updatePackageFromAdmin, draft.values)).map(
			() => ({})
		);
	const args = draft.values;

	return requireEditSessionsPermissionAndLoadBooking(ctx, args.bookingId).andThen((session) =>
		loadAdminSessionEditDeps(ctx).andThen(({ client, settings }) =>
			syncAdminBookingGoogleCalendarAndDb({ ctx, args, session, client, settings }).andThen(
				(result) => notifyHostIfNeeded(ctx, args, session, settings, result)
			)
		)
	);
}

export function saveNonbillableChanges(
	ctx: ActionCtx,
	draft: EditInvoiceDraft
): ResultAsync<AdminSessionUpdateResult, { reason: string }> {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() =>
			fromConvexTuple(
				ctx.runQuery(internal.editInvoices.getContext, { target: getDraftTarget(draft), draft })
			)
		)
		.andThen((context) => checkEditNeedsNoInvoice(ctx, draft, context))
		.andThen(() => saveBookingOrPackageChanges(ctx, draft));
}

function checkEditNeedsNoInvoice(
	ctx: ActionCtx,
	draft: EditInvoiceDraft,
	context: EditInvoiceContext
) {
	if (context.total <= context.currentTotal) return okAsync(null);

	return loadEditInvoicePreviewFromAction(ctx, { target: getDraftTarget(draft), draft }).andThen(
		validateNoInvoiceRequired
	);
}

function sendQuotedInvoice(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
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
	const customerId = context.record.stripeCustomerId;

	if (!customerId) return errAsync({ reason: "STRIPE_CUSTOMER_NOT_FOUND" });
	const input = { lineItems: quote.lineItems, requestId: args.requestId };

	if (quote.target.kind === "booking") {
		return createAndRecordBookingStripeInvoice(
			ctx,
			{ ...input, bookingId: quote.target.bookingId },
			identity,
			customerId
		);
	}

	return createAndRecordPackageStripeInvoice(
		ctx,
		{ ...input, packageId: quote.target.packageId },
		identity,
		customerId
	);
}

function saveChangesAfterInvoice(ctx: ActionCtx, draft: EditInvoiceDraft) {
	return saveBookingOrPackageChanges(ctx, draft).mapErr((failure) => ({
		...failure,
		invoiceSent: true
	}));
}

function executeConfirmedEdit(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext,
	action: "complete" | "save" | "send"
): ResultAsync<AdminSessionUpdateResult, { reason: string; invoiceSent?: boolean }> {
	if (action === "complete") return okAsync({});

	if (action === "save") return saveChangesAfterInvoice(ctx, args.draft);

	return loadEditInvoicePreviewFromAction(ctx, {
		target: getDraftTarget(args.draft),
		draft: args.draft
	})
		.andThen((quote) => sendQuotedInvoice(ctx, args, identity, context, quote))
		.andThen(() => saveChangesAfterInvoice(ctx, args.draft));
}

export function finishConfirmedEdit(
	ctx: ActionCtx,
	args: ConfirmEditInvoiceArgs,
	identity: { email?: string },
	context: EditInvoiceContext
): ResultAsync<AdminSessionUpdateResult, { reason: string; invoiceSent?: boolean }> {
	return getConfirmedEditAction(args, context, Date.now()).asyncAndThen((action) =>
		executeConfirmedEdit(ctx, args, identity, context, action)
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
	return fromConvexTuple(
		ctx.runQuery(internal.editInvoices.getContext, {
			target: getDraftTarget(args.draft),
			draft: args.draft
		})
	).map((context) => ({ identity, context }));
}
