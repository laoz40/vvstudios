import { errAsync, okAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { detectDeliverablesCustomerType } from "#convex/lib/editor/editorSessions";
import { getDriveStatus } from "#convex/lib/drive/driveStatus";
import {
	getBookingRow,
	getSessionFromDb,
	lookupBookingByStripeSessionId,
	normalizeBookingId
} from "#convex/lib/sessions/sessionLookup";
import { buildPublicSessionStatusResponse } from "#convex/services/sessions/sessions";

export function loadSensitiveBookingDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveStatus(ctx, bookingId);
}

export function loadBookingRowForInternal(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId);
}

export function loadInternalDeliverablesCustomerType(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId).andThen((session) =>
		detectDeliverablesCustomerType(ctx, session)
	);
}

export function loadPublicRescheduleCompleteSession(
	ctx: QueryCtx,
	bookingId: string
): NeverthrowResultAsync<
	ReturnType<typeof buildPublicSessionStatusResponse>,
	{ reason: "BOOKING_NOT_FOUND" }
> {
	return normalizeBookingId(ctx, bookingId).asyncAndThen((normalizedBookingId) =>
		getBookingRow(ctx, normalizedBookingId).andThen((session) => {
			if (!session) {
				return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
			}

			return okAsync(buildPublicSessionStatusResponse(session));
		})
	);
}

export function loadSessionStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).map((session) =>
		session === null ? null : buildPublicSessionStatusResponse(session)
	);
}
