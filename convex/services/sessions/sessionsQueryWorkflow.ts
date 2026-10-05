import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { detectDeliverablesCustomerType } from "#convex/lib/editor/editorSessions";
import { getDriveStatus } from "#convex/lib/drive/driveStatus";
import { okOrThrow } from "#convex/lib/result";
import { lookupBookingByStripeSessionId } from "#convex/lib/sessions/sessionLookup";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import { buildPublicSessionStatusResponse } from "#convex/services/sessions/sessions";

export function loadInternalDeliverablesCustomerType(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId).andThen((session) =>
		detectDeliverablesCustomerType(ctx, session)
	);
}

export function resolveDeliverablesCustomerTypeForSession(
	ctx: QueryCtx,
	session: Parameters<typeof detectDeliverablesCustomerType>[1]
) {
	return detectDeliverablesCustomerType(ctx, session);
}

export function loadSessionRowById(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
}

export function loadDriveStatusForSensitiveBooking(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveStatus(ctx, bookingId);
}

export function loadPublicRescheduleCompleteSession(ctx: QueryCtx, bookingId: string) {
	const normalizedBookingId = ctx.db.normalizeId("bookings", bookingId);

	if (normalizedBookingId === null) {
		return err({ reason: "BOOKING_NOT_FOUND" as const });
	}

	return okOrThrow(ctx.db.get("bookings", normalizedBookingId)).andThen((session) => {
		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return ok(buildPublicSessionStatusResponse(session));
	});
}

export function loadSessionStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).map((session) =>
		session === null ? null : buildPublicSessionStatusResponse(session)
	);
}
