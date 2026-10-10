import { errAsync, okAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { detectDeliverablesCustomerType } from "#convex/editor/lib/editorSessions";
import { getDriveStatus } from "#convex/drive/services/driveStatusQuery";
import {
	getBookingRow,
	lookupBookingByStripeSessionId,
	normalizeBookingId
} from "#convex/sessions/lib/sessionLookup";
import { getSessionFromDb } from "#convex/sessions/services/sessionLookup";
import { requirePermission } from "#convex/shared/services/auth";
import { buildPublicSessionStatusResponse } from "#convex/sessions/services/sessions";

function loadDriveStatusAfterPermissionStep(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveStatus(ctx, bookingId);
}

function nullIfMissingBooking(session: Doc<"bookings"> | null) {
	return session ?? null;
}

function deliverablesCustomerTypeStep(ctx: QueryCtx, session: Doc<"bookings">) {
	return detectDeliverablesCustomerType(ctx, session);
}

function requirePublicRescheduleSession(session: Doc<"bookings"> | null) {
	if (!session) {
		return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	}

	return okAsync(buildPublicSessionStatusResponse(session));
}

function publicRescheduleSessionForNormalizedIdStep(
	ctx: QueryCtx,
	normalizedBookingId: Id<"bookings">
) {
	return getBookingRow(ctx, normalizedBookingId).andThen(requirePublicRescheduleSession);
}

function publicStatusFromStripeLookup(session: Doc<"bookings"> | null) {
	return session === null ? null : buildPublicSessionStatusResponse(session);
}

export function loadSensitiveBookingDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		loadDriveStatusAfterPermissionStep(ctx, bookingId)
	);
}

export function loadBookingRowOrNull(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId).map(nullIfMissingBooking);
}

export function loadInternalDeliverablesCustomerType(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId).andThen((session: Doc<"bookings">) =>
		deliverablesCustomerTypeStep(ctx, session)
	);
}

export function loadPublicRescheduleCompleteSession(
	ctx: QueryCtx,
	bookingId: string
): NeverthrowResultAsync<
	ReturnType<typeof buildPublicSessionStatusResponse>,
	{ reason: "BOOKING_NOT_FOUND" }
> {
	return normalizeBookingId(ctx, bookingId).asyncAndThen((normalizedBookingId: Id<"bookings">) =>
		publicRescheduleSessionForNormalizedIdStep(ctx, normalizedBookingId)
	);
}

export function loadSessionStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).map(publicStatusFromStripeLookup);
}
