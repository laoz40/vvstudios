import { okAsync, type ResultAsync } from "neverthrow";
import type { PaginationResult } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getBookingRow } from "#convex/sessions/lib/lookup";
import { listStripeInvoicesForBooking, summarizeStripeInvoices } from "#convex/stripe/lib/invoices";
import { setBookingArchived } from "#convex/shared/lib/archiveState";
import { okOrThrow } from "#convex/shared/lib/result";
import type { StripeInvoiceAmountSummary } from "#convex/stripe/lib/invoices";

const DEAD_CHECKOUT_STATUSES = ["cancelled", "expired", "abandoned"] as const;

const PAST_DEAD_CHECKOUT_ARCHIVE_BATCH_SIZE = 25;

export type DeadCheckoutStatus = (typeof DEAD_CHECKOUT_STATUSES)[number];

export function getDeadCheckoutArchiveBatchSize(numItems: number | undefined) {
	return numItems ?? PAST_DEAD_CHECKOUT_ARCHIVE_BATCH_SIZE;
}

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

export type SessionStripeArchiveSummary = {
	session: Doc<"bookings">;
	stripeSummary: StripeInvoiceAmountSummary | null;
};

export function loadDeadCheckoutArchivePage(
	ctx: MutationCtx,
	cursor: string | null,
	numItems: number
) {
	return okOrThrow(ctx.db.query("bookings").paginate({ cursor, numItems }));
}

export function archiveLoadedDeadCheckoutPage(
	ctx: MutationCtx,
	{ continueCursor, isDone, page }: PaginationResult<Doc<"bookings">>,
	now: number
): ResultAsync<ArchivePastDeadCheckoutBatchResult, never> {
	const bookingsToArchive = page.filter(
		(booking) =>
			!booking.archived &&
			isDeadCheckoutStatus(booking.status) &&
			shouldArchiveDeadCheckoutBooking(booking.sessionStartAt, now)
	);

	return okOrThrow(
		Promise.all(
			bookingsToArchive.map((booking) => ctx.db.patch("bookings", booking._id, { archived: true }))
		)
	).map(() => ({
		continueCursor: isDone ? null : continueCursor,
		isDone,
		newlyArchived: bookingsToArchive.length,
		scanned: page.length
	}));
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
			Object.assign(merged, { archived: true });
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

export function archiveSessionIfEligible(
	ctx: MutationCtx,
	bookingId: Id<"bookings"> | null,
	now: number,
	summary: SessionStripeArchiveSummary | null
): ResultAsync<null, never> {
	if (summary === null || bookingId === null) return okAsync(null);
	const { session, stripeSummary } = summary;

	if (session.archived || !isSessionEligibleForAutoArchive(session, stripeSummary, now))
		return okAsync(null);

	return setBookingArchived(ctx, bookingId, true);
}

export function loadSessionForAutoArchive(ctx: MutationCtx, bookingId: Id<"bookings"> | null) {
	if (bookingId === null) return okAsync<Doc<"bookings"> | null>(null);

	return getBookingRow(ctx, bookingId);
}

export function loadSessionInvoiceSummary(
	ctx: MutationCtx,
	session: Doc<"bookings"> | null
): ResultAsync<SessionStripeArchiveSummary | null, never> {
	if (session === null) return okAsync(null);

	return listStripeInvoicesForBooking(ctx, session._id).map((invoices) => ({
		session,
		stripeSummary: summarizeStripeInvoices(invoices)
	}));
}

/** Puts a confirmed session back in the admin inbox when a new unpaid invoice needs attention. */
export function unarchiveSessionForNewUnpaidInvoice(
	ctx: MutationCtx,
	session: Doc<"bookings"> | null
): ResultAsync<null, never> {
	if (session === null) return okAsync(null);

	if (!session.archived) {
		return okAsync(null);
	}

	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return okAsync(null);
	}

	return setBookingArchived(ctx, session._id, false);
}
