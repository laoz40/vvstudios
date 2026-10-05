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

export function archiveDeadCheckoutBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	updates: Partial<Doc<"bookings">>,
	now = Date.now()
): ResultAsync<null, never> {
	return getSessionFromDb(ctx, bookingId)
		.andThen((session) =>
			patchBookingFields(ctx, bookingId, mergeDeadCheckoutBookingUpdates(session, updates, now))
		)
		.orElse(() => okAsync(null));
}

export function archiveSessionWhenFullyDone(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	now = Date.now()
): ResultAsync<null, never> {
	return getSessionFromDb(ctx, bookingId)
		.andThen((session) =>
			listStripeInvoicesForBooking(ctx, bookingId).map((invoices) => ({
				session,
				stripeSummary: summarizeStripeInvoices(invoices)
			}))
		)
		.andThen(({ session, stripeSummary }) => {
			if (isBookingArchived(session)) {
				return okAsync(null);
			}

			if (!isSessionEligibleForAutoArchive(session, stripeSummary, now)) {
				return okAsync(null);
			}

			return setBookingArchived(ctx, bookingId, true);
		})
		.orElse(() => okAsync(null));
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
