import { ok, okAsync, safeTry } from "neverthrow";
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
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, bookingId);

		return ok(
			yield* patchBookingFields(
				ctx,
				bookingId,
				mergeDeadCheckoutBookingUpdates(session, updates, now)
			)
		);
	}).orElse(() => okAsync(null));
}

export function archiveSessionWhenFullyDone(
	ctx: MutationCtx,
	bookingId: Id<"bookings"> | null,
	now = Date.now()
) {
	return safeTry(async function* () {
		const session = yield* loadSessionForAutoArchive(ctx, bookingId);
		const summary = yield* loadSessionInvoiceSummary(ctx, session);

		return ok(yield* archiveSessionIfEligible(ctx, bookingId, now, summary));
	}).orElse(() => okAsync(null));
}

export function runArchivePastDeadCheckoutBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems?: number
) {
	return safeTry(async function* () {
		const page = yield* loadDeadCheckoutArchivePage(
			ctx,
			cursor,
			getDeadCheckoutArchiveBatchSize(numItems)
		);

		return ok(yield* archiveLoadedDeadCheckoutPage(ctx, page, Date.now()));
	});
}
