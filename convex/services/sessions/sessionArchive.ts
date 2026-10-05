import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { isBookingArchived, setBookingArchived } from "#convex/lib/archiveState";
import { tryPromise } from "#convex/lib/result";
import {
	archivePastDeadCheckoutSessionsBatch,
	isSessionEligibleForAutoArchive,
	mergeDeadCheckoutBookingUpdates,
	patchBookingFields
} from "#convex/lib/sessions/sessionArchive";
import {
	listStripeInvoicesForBooking,
	summarizeStripeInvoices
} from "#convex/lib/stripe/stripeInvoices";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";

function patchDeadCheckoutBookingStep(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	updates: Partial<Doc<"bookings">>,
	now: number
) {
	return (session: Doc<"bookings">) =>
		patchBookingFields(ctx, bookingId, mergeDeadCheckoutBookingUpdates(session, updates, now));
}

export function archiveDeadCheckoutBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	updates: Partial<Doc<"bookings">>,
	now = Date.now()
): ResultAsync<null, never> {
	return getSessionFromDb(ctx, bookingId)
		.andThen(patchDeadCheckoutBookingStep(ctx, bookingId, updates, now))
		.orElse(ignoreArchiveFailureStep);
}

function ignoreArchiveFailureStep() {
	return okAsync(null);
}

function sessionStripeSummaryStep(session: Doc<"bookings">) {
	return (invoices: Parameters<typeof summarizeStripeInvoices>[0]) => ({
		session,
		stripeSummary: summarizeStripeInvoices(invoices)
	});
}

function stripeSummaryForAutoArchiveStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return (session: Doc<"bookings">) =>
		listStripeInvoicesForBooking(ctx, bookingId).map(sessionStripeSummaryStep(session));
}

function archiveWhenFullyDoneEligibleStep(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	now: number
) {
	return ({
		session,
		stripeSummary
	}: {
		session: Doc<"bookings">;
		stripeSummary: ReturnType<typeof summarizeStripeInvoices>;
	}) => {
		if (isBookingArchived(session)) {
			return okAsync(null);
		}

		if (!isSessionEligibleForAutoArchive(session, stripeSummary, now)) {
			return okAsync(null);
		}

		return setBookingArchived(ctx, bookingId, true);
	};
}

export function archiveSessionWhenFullyDone(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	now = Date.now()
): ResultAsync<null, never> {
	return getSessionFromDb(ctx, bookingId)
		.andThen(stripeSummaryForAutoArchiveStep(ctx, bookingId))
		.andThen(archiveWhenFullyDoneEligibleStep(ctx, bookingId, now))
		.orElse(ignoreArchiveFailureStep);
}

export function runArchivePastDeadCheckoutBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems?: number
) {
	return tryPromise({
		try: () => archivePastDeadCheckoutSessionsBatch(ctx, cursor, numItems),
		catch: () => ({ reason: "SESSION_ARCHIVE_FAILED" as const })
	});
}
