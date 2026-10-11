import { type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { detectDeliverablesCustomerType } from "#convex/editor/lib/editorSessions";
import { getDriveStatus } from "#convex/drive/services/driveStatusQuery";
import {
	getBookingRow,
	lookupBookingByStripeSessionId,
	normalizeBookingId
} from "#convex/sessions/lib/lookup";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import { requirePermission } from "#convex/shared/services/auth";
import {
	buildPublicSessionStatusResponse,
	nullIfMissingBooking,
	publicStatusFromStripeLookup,
	requirePublicRescheduleSession
} from "#convex/sessions/lib/adminList";

function publicRescheduleSessionForNormalizedIdStep(
	ctx: QueryCtx,
	normalizedBookingId: Id<"bookings">
) {
	return getBookingRow(ctx, normalizedBookingId).andThen(requirePublicRescheduleSession);
}

export function loadSensitiveBookingDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return requirePermission(ctx, "view:sensitive-booking-data").andThen(() =>
		getDriveStatus(ctx, bookingId)
	);
}

export function loadBookingRowOrNull(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getBookingRow(ctx, bookingId).map(nullIfMissingBooking);
}

export function loadInternalDeliverablesCustomerType(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId).andThen((session: Doc<"bookings">) =>
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
	return normalizeBookingId(ctx, bookingId).asyncAndThen((normalizedBookingId: Id<"bookings">) =>
		publicRescheduleSessionForNormalizedIdStep(ctx, normalizedBookingId)
	);
}

export function loadSessionStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupBookingByStripeSessionId(ctx, stripeSessionId).map(publicStatusFromStripeLookup);
}
