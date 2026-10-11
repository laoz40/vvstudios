import { okAsync, type ResultAsync } from "neverthrow";
import type { PaginationResult } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	archiveLoadedDeadCheckoutPage,
	archiveSessionIfEligible,
	loadSessionForAutoArchive,
	loadSessionInvoiceSummary,
	getDeadCheckoutArchiveBatchSize,
	loadDeadCheckoutArchivePage,
	mergeDeadCheckoutBookingUpdates,
	patchBookingFields
} from "#convex/sessions/lib/archive";
import { getSessionFromDb } from "#convex/sessions/services/lookup";

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
	bookingId: Id<"bookings"> | null,
	now = Date.now()
): ResultAsync<null, never> {
	return loadSessionForAutoArchive(ctx, bookingId)
		.andThen((session) => loadSessionInvoiceSummary(ctx, session))
		.andThen((summary) => archiveSessionIfEligible(ctx, bookingId, now, summary))
		.orElse(() => okAsync(null));
}

export function runArchivePastDeadCheckoutBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems?: number
) {
	return loadDeadCheckoutArchivePage(
		ctx,
		cursor,
		getDeadCheckoutArchiveBatchSize(numItems)
	).andThen((page: PaginationResult<Doc<"bookings">>) =>
		archiveLoadedDeadCheckoutPage(ctx, page, Date.now())
	);
}
