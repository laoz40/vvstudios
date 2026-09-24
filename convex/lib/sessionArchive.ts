import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDb } from "#convex/lib/sessionLookup";
import {
	listStripeInvoicesForBooking,
	summarizeStripeInvoices,
	type StripeInvoiceAmountSummary
} from "#convex/lib/stripeInvoices";

const DEAD_CHECKOUT_STATUSES = ["cancelled", "expired", "abandoned"] as const;

export type DeadCheckoutStatus = (typeof DEAD_CHECKOUT_STATUSES)[number];

export function isDeadCheckoutStatus(
	status: Doc<"bookings">["status"]
): status is DeadCheckoutStatus {
	return status === "cancelled" || status === "expired" || status === "abandoned";
}

export function archiveDeadCheckoutBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	updates: Partial<Doc<"bookings">>,
	now = Date.now()
): ResultAsync<null, never> {
	const merged: Partial<Doc<"bookings">> = { ...updates };

	if (updates.status !== undefined && isDeadCheckoutStatus(updates.status)) {
		merged.hiddenAt = merged.hiddenAt ?? now;
	}

	return okOrThrow(ctx.db.patch(bookingId, merged).then(() => null));
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
			if (session.hiddenAt !== undefined) {
				return okAsync(null);
			}

			if (!isSessionEligibleForAutoArchive(session, stripeSummary, now)) {
				return okAsync(null);
			}

			return okOrThrow(ctx.db.patch(bookingId, { hiddenAt: now }).then(() => null));
		})
		.orElse(() => okAsync(null));
}

/** Puts a confirmed session back in the admin inbox when a new unpaid invoice needs attention. */
export function unarchiveSessionForNewUnpaidInvoice(
	ctx: MutationCtx,
	session: Doc<"bookings">
): ResultAsync<null, never> {
	if (session.hiddenAt === undefined) {
		return okAsync(null);
	}

	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return okAsync(null);
	}

	return okOrThrow(ctx.db.patch(session._id, { hiddenAt: undefined }).then(() => null));
}
