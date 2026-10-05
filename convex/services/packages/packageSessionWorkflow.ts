import { err, ok } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	checkPackageIdSubmitRateLimit,
	cancelPackageSessionBooking,
	cleanupCancelledPackageSessionDrive,
	clearPackageSessionReservation,
	createPackageSessionCalendarEvent,
	deletePackageSessionCalendarEvent,
	loadPackageRescheduleRequest,
	loadPackageSessionRequest,
	loadPackageUnscheduleRequest,
	reservePackageSessionSlot,
	saveCreatedPackageSession,
	savePackageSessionReschedule,
	updatePackageSessionCalendarEvent
} from "#convex/lib/packages/packageSchedulingActionBoundaries";
import type {
	CreatePackageSessionError,
	ReschedulePackageSessionError,
	UnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";
import {
	toPackageCalendarDetails,
	toPackageCalendarSession
} from "#convex/lib/packages/packageScheduling";
import type { ValidPackageByTokenError } from "#convex/lib/packages/packageLookup";
import type { PackageCalendarWriteError } from "#convex/services/googleCalendar/packageSchedulingCalendar";
import type { GoogleCalendarWriteError } from "#convex/lib/googleCalendar/googleCalendarErrors";
import type {
	PackageRescheduleRequestDetails,
	PackageSessionRequestDetails,
	PackageUnscheduleRequestDetails,
	SaveCreatedPackageSessionArgs
} from "#convex/services/packages/packageScheduling";
import { getPackageSessionAddons } from "#studio/features/booking-form/lib/booking-form-model";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

export type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: RecordingSpace;
	notes?: string;
	remotePodcast: boolean;
};

export type ReschedulePackageSessionArgs = PackageSessionArgs & { bookingId: Id<"bookings"> };

export type UnschedulePackageSessionArgs = { bookingId: Id<"bookings">; token: string };

export function authorizePackageSessionCreate(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number
): ResultAsync<PackageSessionRequestDetails, CreatePackageSessionError> {
	return loadPackageSessionRequest(ctx, {
		token: args.token,
		date: args.date,
		time: args.time,
		now
	}).andThen((details) =>
		checkPackageIdSubmitRateLimit(ctx, details.packageRecord._id).map(() => details)
	);
}

export function syncNewPackageSessionCalendar(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	details: PackageSessionRequestDetails
): ResultAsync<
	{
		calendar: { googleCalendarId?: string; googleEventId?: string };
		details: PackageSessionRequestDetails;
	},
	PackageCalendarWriteError
> {
	return createPackageSessionCalendarEvent(ctx, {
		session: null,
		details: toPackageCalendarDetails(args, details.packageRecord, details.eventBufferMinutes)
	}).map((calendar) => ({ calendar, details }));
}

export function persistNewPackageSession(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	details: PackageSessionRequestDetails
): ResultAsync<{ bookingId: Id<"bookings"> }, CreatePackageSessionError> {
	const saveArgs: SaveCreatedPackageSessionArgs = { ...args, now };

	if (calendar.googleCalendarId) {
		saveArgs.googleCalendarId = calendar.googleCalendarId;
	}

	if (calendar.googleEventId) {
		saveArgs.googleEventId = calendar.googleEventId;
	}

	return saveCreatedPackageSession(ctx, saveArgs).orElse((saveError) => {
		if (!calendar.googleEventId || !calendar.googleCalendarId) {
			return err(saveError);
		}

		return deletePackageSessionCalendarEvent(ctx, {
			date: args.date,
			duration: details.packageRecord.duration,
			email: details.packageRecord.email,
			googleCalendarId: calendar.googleCalendarId,
			googleEventId: calendar.googleEventId,
			name: details.packageRecord.name,
			time: args.time
		})
			.mapErr((cleanupError) => {
				console.error("Failed to compensate orphan package Calendar event", cleanupError);

				return saveError;
			})
			.andThen(() => err(saveError));
	});
}

export function loadPackageRescheduleTarget(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	now: number
): ResultAsync<PackageRescheduleRequestDetails, ReschedulePackageSessionError> {
	return loadPackageRescheduleRequest(ctx, {
		token: args.token,
		bookingId: args.bookingId,
		date: args.date,
		time: args.time,
		now
	});
}

export function reservePackageRescheduleSlot(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	details: PackageRescheduleRequestDetails
) {
	return reservePackageSessionSlot(ctx, {
		bookingId: args.bookingId,
		duration: details.packageRecord.duration,
		eventBufferMinutes: details.eventBufferMinutes,
		sessionStartAt: details.sessionStartAt
	}).andThen((reservationResult) =>
		reservationResult.outcome === "unavailable"
			? err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
			: ok(reservationResult.reservation)
	);
}

export function syncPackageRescheduleCalendar(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	details: PackageRescheduleRequestDetails,
	reservation: SessionReservation
): ResultAsync<
	{
		calendar: { googleCalendarId?: string; googleEventId?: string };
		details: PackageRescheduleRequestDetails;
		reservation: SessionReservation;
	},
	ReschedulePackageSessionError
> {
	return updatePackageSessionCalendarEvent(ctx, {
		session: toPackageCalendarSession(details.session),
		details: toPackageCalendarDetails(args, details.packageRecord, details.eventBufferMinutes)
	})
		.map((calendar) => ({ calendar, details, reservation }))
		.orElse((calendarError) =>
			clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(() => {
				// SAFETY: Package calendar failures use the same `reason` codes as reschedule session errors.
				return err(calendarError as ReschedulePackageSessionError);
			})
		);
}

export function persistPackageReschedule(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	details: PackageRescheduleRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	reservation: SessionReservation
): ResultAsync<{ bookingId: Id<"bookings"> }, ReschedulePackageSessionError> {
	return savePackageSessionReschedule(ctx, {
		bookingId: args.bookingId,
		date: args.date,
		time: args.time,
		service: args.service,
		notes: args.notes,
		addons: getPackageSessionAddons(details.packageRecord.addons, args.remotePodcast),
		sessionStartAt: details.sessionStartAt,
		googleCalendarId: calendar.googleCalendarId,
		googleEventId: calendar.googleEventId,
		packageId: details.packageRecord._id,
		reservation
	})
		.map(() => ({ bookingId: args.bookingId }))
		.orElse((saveError) =>
			clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(() =>
				err(saveError)
			)
		);
}

export function loadPackageUnscheduleTarget(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs,
	now: number
): ResultAsync<
	PackageUnscheduleRequestDetails,
	ValidPackageByTokenError | UnschedulePackageSessionError
> {
	return loadPackageUnscheduleRequest(ctx, { ...args, now });
}

export function clearPackageSessionCalendar(
	ctx: ActionCtx,
	details: PackageUnscheduleRequestDetails
): ResultAsync<null, GoogleCalendarWriteError> {
	return deletePackageSessionCalendarEvent(ctx, toPackageCalendarSession(details.session));
}

export function markPackageSessionCancelled(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs,
	now: number
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	return cancelPackageSessionBooking(ctx, { ...args, now });
}

export function cleanupCancelledPackageDrive(
	ctx: ActionCtx,
	cancelled: { cancelled: true; bookingId: Id<"bookings"> }
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	return cleanupCancelledPackageSessionDrive(ctx, cancelled.bookingId).map(() => cancelled);
}
