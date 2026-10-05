import { errAsync, okAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { detectDeliverablesCustomerType } from "#convex/lib/editor/editorSessions";
import { getDriveStatus } from "#convex/services/drive/driveStatusQuery";
import {
	getBookingRow,
	lookupBookingByStripeSessionId,
	normalizeBookingId
} from "#convex/lib/sessions/sessionLookup";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
import { requirePermission } from "#convex/services/auth";
import { buildPublicSessionStatusResponse } from "#convex/services/sessions/sessions";

export function loadSensitiveBookingDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		getDriveStatus(ctx, bookingId)
	);
}

export function loadBookingRowOrNull(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId).map((session) => session ?? null);
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
