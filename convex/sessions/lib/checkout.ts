import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { mergeDeadCheckoutBookingUpdates, patchBookingFields } from "#convex/sessions/lib/archive";
import { getBookingRow } from "#convex/sessions/lib/lookup";

export type ExpireSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_INVALID_STATUS"; status: Doc<"bookings">["status"] };

export type ExpireSessionDecision =
	| { kind: "complete"; alreadyExpired: true }
	| { kind: "expire"; bookingId: Doc<"bookings">["_id"] };

export type DeletePendingSessionSuccess =
	| { outcome: "not_found" }
	| { outcome: "not_pending"; status: Doc<"bookings">["status"] }
	| { outcome: "abandoned" };

export type DeletePendingSessionDecision =
	| { kind: "complete"; value: DeletePendingSessionSuccess }
	| { kind: "abandon" };

export function validateSessionExpiry(
	booking: Doc<"bookings"> | null
): Result<ExpireSessionDecision, ExpireSessionError> {
	if (!booking) return err({ reason: "BOOKING_NOT_FOUND" });

	if (booking.status === "expired") {
		return ok({ kind: "complete", alreadyExpired: true });
	}

	if (booking.status !== "pending_payment") {
		return err({ reason: "BOOKING_INVALID_STATUS", status: booking.status });
	}

	return ok({ kind: "expire", bookingId: booking._id });
}

export function validatePendingSessionDeletion(
	booking: Doc<"bookings"> | null,
	stripeSessionId: string
): Result<DeletePendingSessionDecision, { reason: "STRIPE_SESSION_MISMATCH" }> {
	if (!booking) return ok({ kind: "complete", value: { outcome: "not_found" } });

	if (booking.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" });
	}

	if (booking.status !== "pending_payment") {
		return ok({ kind: "complete", value: { outcome: "not_pending", status: booking.status } });
	}

	return ok({ kind: "abandon" });
}

function writeDeadCheckoutBookingStatus(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	status: "expired" | "abandoned",
	now = Date.now()
): ResultAsync<null, never> {
	return getBookingRow(ctx, bookingId)
		.andThen((session) => {
			if (session === null) {
				return okAsync(null);
			}

			return patchBookingFields(
				ctx,
				bookingId,
				mergeDeadCheckoutBookingUpdates(session, { status }, now)
			);
		})
		.orElse(() => okAsync(null));
}

export function writeExpiredCheckoutBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	now = Date.now()
): ResultAsync<{ alreadyExpired: false }, never> {
	return writeDeadCheckoutBookingStatus(ctx, bookingId, "expired", now).map(() => ({
		alreadyExpired: false as const
	}));
}

export function writeAbandonedCheckoutBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	now = Date.now()
): ResultAsync<Extract<DeletePendingSessionSuccess, { outcome: "abandoned" }>, never> {
	return writeDeadCheckoutBookingStatus(ctx, bookingId, "abandoned", now).map(() => ({
		outcome: "abandoned" as const
	}));
}

export function expireBookingAfterValidate(
	ctx: MutationCtx,
	decision: ExpireSessionDecision
): ResultAsync<{ alreadyExpired: boolean }, never> {
	if (decision.kind === "complete") {
		return okAsync({ alreadyExpired: decision.alreadyExpired });
	}

	return writeExpiredCheckoutBooking(ctx, decision.bookingId);
}

export function abandonBookingAfterValidate(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	decision: DeletePendingSessionDecision
): ResultAsync<DeletePendingSessionSuccess, never> {
	if (decision.kind === "complete") {
		return okAsync(decision.value);
	}

	return writeAbandonedCheckoutBooking(ctx, bookingId);
}
