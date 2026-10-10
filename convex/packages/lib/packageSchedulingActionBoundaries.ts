import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { SessionCalendarEventRecord } from "#convex/sessions/lib/sessionCalendarEventPayload";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { runReserveSessionReservation } from "#convex/sessions/lib/sessionSlotReservationAction";
import type { SaveClientSessionRescheduleArgs } from "#convex/sessions/lib/sessionSchedulingArgs";
import type { SessionReservation } from "#convex/sessions/lib/sessionReservations";
import type {
	PackageRescheduleRequestDetails,
	PackageSessionRequestDetails,
	PackageUnscheduleRequestDetails,
	SaveCreatedPackageSessionArgs
} from "#convex/packages/services/packageSessionMutations";
import {
	toPackageCalendarDetails,
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "#convex/packages/lib/packageScheduling";
import type { ValidPackageByTokenError } from "#convex/packages/lib/packageLookup";
import type { PackageCalendarWriteError } from "#convex/googleCalendar/services/packageSchedulingCalendar";
import type { GoogleCalendarWriteError } from "#convex/googleCalendar/lib/googleCalendarErrors";

type PackageSessionCalendarDetails = ReturnType<typeof toPackageCalendarDetails>;

export function loadPackageSessionRequest(
	ctx: ActionCtx,
	args: { token: string; date: string; time: string; now: number }
): ResultAsync<PackageSessionRequestDetails, CreatePackageSessionError> {
	return fromConvexTuple(
		ctx.runQuery(internal.packages.packageScheduling.validatePackageSessionRequest, args)
	);
}

export function checkPackageIdSubmitRateLimit(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<null, CreatePackageSessionError> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.packages.checkPackageSubmitRateLimit, {
			submitRateLimitKey: `package:${packageId}`
		})
	);
}

export function createPackageSessionCalendarEvent(
	ctx: ActionCtx,
	args: { session: SessionCalendarEventRecord | null; details: PackageSessionCalendarDetails }
): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return fromConvexTuple(
		ctx.runAction(
			internal.packages.packageSchedulingCalendar.createPackageSessionCalendarEvent,
			args
		)
	);
}

export function deletePackageSessionCalendarEvent(
	ctx: ActionCtx,
	session: SessionCalendarEventRecord
): ResultAsync<null, GoogleCalendarWriteError> {
	return fromConvexTuple(
		ctx.runAction(internal.packages.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
			session
		})
	).map(() => null);
}

export function saveCreatedPackageSession(
	ctx: ActionCtx,
	args: SaveCreatedPackageSessionArgs
): ResultAsync<{ bookingId: Id<"bookings"> }, CreatePackageSessionError> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.packageScheduling.saveCreatedPackageSession, args)
	);
}

export function loadPackageRescheduleRequest(
	ctx: ActionCtx,
	args: { token: string; bookingId: Id<"bookings">; date: string; time: string; now: number }
): ResultAsync<PackageRescheduleRequestDetails, ReschedulePackageSessionError> {
	return fromConvexTuple(
		ctx.runQuery(internal.packages.packageScheduling.validatePackageRescheduleRequest, args)
	);
}

export function reservePackageSessionSlot(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		sessionStartAt: number;
	}
) {
	return runReserveSessionReservation(ctx, args);
}

export function clearPackageSessionReservation(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; reservation: SessionReservation }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.clearSessionReservation, args)
	);
}

export function updatePackageSessionCalendarEvent(
	ctx: ActionCtx,
	args: { session: SessionCalendarEventRecord; details: PackageSessionCalendarDetails }
): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return fromConvexTuple(
		ctx.runAction(
			internal.packages.packageSchedulingCalendar.updatePackageSessionCalendarEvent,
			args
		)
	);
}

export function savePackageSessionReschedule(
	ctx: ActionCtx,
	args: SaveClientSessionRescheduleArgs
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionScheduling.saveClientSessionReschedule, args)
	);
}

export function loadPackageUnscheduleRequest(
	ctx: ActionCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
): ResultAsync<
	PackageUnscheduleRequestDetails,
	ValidPackageByTokenError | UnschedulePackageSessionError
> {
	return fromConvexTuple(
		ctx.runQuery(internal.packages.packageScheduling.validatePackageUnscheduleRequest, args)
	);
}

export function cancelPackageSessionBooking(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; token: string; now: number }
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.packageScheduling.cancelPackageSession, args)
	);
}

export function cleanupCancelledPackageSessionDrive(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, UnschedulePackageSessionError> {
	return fromConvexTuple(
		ctx.runAction(internal.googleCalendar.googleCalendar.cleanupCancelledSessionDrive, {
			bookingId
		})
	);
}
