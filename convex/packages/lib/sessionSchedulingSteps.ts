import { err, ok } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { checkPackageIdSubmitRateLimit } from "#convex/packages/lib/schedulingActionBoundaries";

import type {
	PackageSessionRequestDetails,
	SaveCreatedPackageSessionArgs
} from "#convex/packages/services/sessionMutations";

import type { SessionReservation } from "#convex/sessions/lib/reservations";
import type { BookingService } from "#/domain/booking/catalog";

type RecordingSpace = BookingService;

export type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: RecordingSpace;
	notes?: string;
	remotePodcast: boolean;
};

export function checkRateLimitForPackageSession(
	ctx: ActionCtx,
	details: PackageSessionRequestDetails
) {
	return checkPackageIdSubmitRateLimit(ctx, details.packageRecord._id).map(() => details);
}

export function reservationFromPackageSessionSlot(
	reservationResult:
		| { outcome: "unavailable" }
		| { outcome: "reserved"; reservation: SessionReservation }
) {
	return reservationResult.outcome === "unavailable"
		? err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		: ok(reservationResult.reservation);
}

export function createdPackageSessionSaveArgs(
	args: PackageSessionArgs,
	now: number,
	calendar: { googleCalendarId?: string; googleEventId?: string }
): SaveCreatedPackageSessionArgs {
	const saveArgs: SaveCreatedPackageSessionArgs = { ...args, now };

	if (calendar.googleCalendarId) saveArgs.googleCalendarId = calendar.googleCalendarId;

	if (calendar.googleEventId) saveArgs.googleEventId = calendar.googleEventId;

	return saveArgs;
}
