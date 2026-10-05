import type { PaginationResult } from "convex/server";
import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	bookingArchivedPatch,
	isBookingArchived,
	setBookingArchived
} from "#convex/lib/archiveState";
import { okOrThrow } from "#convex/lib/result";
import type { StripeInvoiceAmountSummary } from "#convex/lib/stripe/stripeInvoices";

const DEAD_CHECKOUT_STATUSES = ["cancelled", "expired", "abandoned"] as const;

export type DeadCheckoutStatus = (typeof DEAD_CHECKOUT_STATUSES)[number];

export function isDeadCheckoutStatus(
	status: Doc<"bookings">["status"]
): status is DeadCheckoutStatus {
	return status === "cancelled" || status === "expired" || status === "abandoned";
}

export function shouldArchiveDeadCheckoutBooking(
	sessionStartAt: number,
	now = Date.now()
): boolean {
	return sessionStartAt < now;
}

export type ArchivePastDeadCheckoutBatchResult = {
	continueCursor: string | null;
	isDone: boolean;
	newlyArchived: number;
	scanned: number;
};

const PAST_DEAD_CHECKOUT_ARCHIVE_BATCH_SIZE = 25;

function archiveBookingsOnDeadCheckoutPage(
	ctx: MutationCtx,
	bookings: Doc<"bookings">[],
	now: number
): ResultAsync<number, never> {
	if (bookings.length === 0) {
		return okAsync(0);
	}

	const [booking, ...rest] = bookings;

	if (booking === undefined) {
		return okAsync(0);
	}

	if (isBookingArchived(booking) || !isDeadCheckoutStatus(booking.status)) {
		return archiveBookingsOnDeadCheckoutPage(ctx, rest, now);
	}

	if (!shouldArchiveDeadCheckoutBooking(booking.sessionStartAt, now)) {
		return archiveBookingsOnDeadCheckoutPage(ctx, rest, now);
	}

	return setBookingArchived(ctx, booking._id, true).andThen(() =>
		archiveBookingsOnDeadCheckoutPage(ctx, rest, now).map((archivedRest) => archivedRest + 1)
	);
}

function archivePastDeadCheckoutSessionsBatchChain(
	ctx: MutationCtx,
	cursor: string | null,
	numItems: number,
	now: number
): ResultAsync<ArchivePastDeadCheckoutBatchResult, never> {
	return okOrThrow(ctx.db.query("bookings").paginate({ cursor, numItems })).andThen(
		(page: PaginationResult<Doc<"bookings">>) =>
			archiveBookingsOnDeadCheckoutPage(ctx, page.page, now).map((newlyArchived) => ({
				continueCursor: page.isDone ? null : page.continueCursor,
				isDone: page.isDone,
				newlyArchived,
				scanned: page.page.length
			}))
	);
}

/** Archives unarchived cancelled / expired / abandoned bookings after session start. */
export function archivePastDeadCheckoutSessionsBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems = PAST_DEAD_CHECKOUT_ARCHIVE_BATCH_SIZE,
	now = Date.now()
): ResultAsync<ArchivePastDeadCheckoutBatchResult, never> {
	return archivePastDeadCheckoutSessionsBatchChain(ctx, cursor, numItems, now);
}

export function archivePastDeadCheckoutSessionsBatchStep(
	ctx: MutationCtx,
	cursor: string | null,
	numItems?: number
) {
	return archivePastDeadCheckoutSessionsBatch(ctx, cursor, numItems);
}

export function mergeDeadCheckoutBookingUpdates(
	session: Doc<"bookings">,
	updates: Partial<Doc<"bookings">>,
	now = Date.now()
): Partial<Doc<"bookings">> {
	const merged: Partial<Doc<"bookings">> = { ...updates };

	if (updates.status !== undefined && isDeadCheckoutStatus(updates.status)) {
		const sessionStartAt = merged.sessionStartAt ?? session.sessionStartAt;

		if (shouldArchiveDeadCheckoutBooking(sessionStartAt, now)) {
			Object.assign(merged, bookingArchivedPatch());
		}
	}

	return merged;
}

export function patchBookingFields(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	updates: Partial<Doc<"bookings">>
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, updates).then(() => null));
}

export function isSessionEligibleForAutoArchive(
	session: Pick<Doc<"bookings">, "status" | "sessionStartAt" | "editStatus">,
	stripeSummary: StripeInvoiceAmountSummary | null,
	now = Date.now()
): boolean {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return false;
	}

	if (session.sessionStartAt >= now) {
		return false;
	}

	if (session.editStatus !== "completed") {
		return false;
	}

	if (stripeSummary?.paymentStatus === "unpaid") {
		return false;
	}

	return true;
}

/** Puts a confirmed session back in the admin inbox when a new unpaid invoice needs attention. */
export function unarchiveSessionForNewUnpaidInvoice(
	ctx: MutationCtx,
	session: Doc<"bookings">
): ResultAsync<null, never> {
	if (!isBookingArchived(session)) {
		return okAsync(null);
	}

	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return okAsync(null);
	}

	return setBookingArchived(ctx, session._id, false);
}
