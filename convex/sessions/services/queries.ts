import { ok, safeTry, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	detectDeliverablesCustomerType,
	type DeliverablesCustomerType
} from "#convex/editor/lib/editorSessions";
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
	return safeTry(async function* () {
		const booking = yield* getBookingRow(ctx, normalizedBookingId);
		const session = yield* requirePublicRescheduleSession(booking);

		return ok(session);
	});
}

export function loadSensitiveBookingDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "view:sensitive-booking-data");
		const driveStatus = yield* getDriveStatus(ctx, bookingId);

		return ok(driveStatus);
	});
}

export function loadBookingRowOrNull(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const booking = yield* getBookingRow(ctx, bookingId);

		return ok(nullIfMissingBooking(booking));
	});
}

export function loadInternalDeliverablesCustomerType(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, bookingId);

		const customerType: DeliverablesCustomerType = yield* detectDeliverablesCustomerType(
			ctx,
			session
		);

		return ok(customerType);
	});
}

export function loadPublicRescheduleCompleteSession(
	ctx: QueryCtx,
	bookingId: string
): NeverthrowResultAsync<
	ReturnType<typeof buildPublicSessionStatusResponse>,
	{ reason: "BOOKING_NOT_FOUND" }
> {
	return safeTry(async function* () {
		const normalizedBookingId = yield* normalizeBookingId(ctx, bookingId);
		const session = yield* publicRescheduleSessionForNormalizedIdStep(ctx, normalizedBookingId);

		return ok(session);
	});
}

export function loadSessionStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return safeTry(async function* () {
		const lookup = yield* lookupBookingByStripeSessionId(ctx, stripeSessionId);

		return ok(publicStatusFromStripeLookup(lookup));
	});
}
