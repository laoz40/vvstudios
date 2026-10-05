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
} from "#convex/services/packages/packageSessionMutations";
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

function keepPackageSessionRequestDetails(details: PackageSessionRequestDetails) {
	return details;
}

function checkRateLimitForPackageSession(ctx: ActionCtx, details: PackageSessionRequestDetails) {
	return checkPackageIdSubmitRateLimit(ctx, details.packageRecord._id).map(() =>
		keepPackageSessionRequestDetails(details)
	);
}

export function loadPackageCreateRequestAndCheckRateLimit(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number
): ResultAsync<PackageSessionRequestDetails, CreatePackageSessionError> {
	return loadPackageSessionRequest(ctx, {
		token: args.token,
		date: args.date,
		time: args.time,
		now
	}).andThen((details: PackageSessionRequestDetails) =>
		checkRateLimitForPackageSession(ctx, details)
	);
}

function attachCalendarToPackageSessionDetails(
	details: PackageSessionRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string }
) {
	return { calendar, details };
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
	}).map((calendar: { googleCalendarId?: string; googleEventId?: string }) =>
		attachCalendarToPackageSessionDetails(details, calendar)
	);
}

function failWithSaveError<T>(saveError: T) {
	return err(saveError);
}

function compensateOrphanCalendarAndFail<T>(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	details: PackageSessionRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	saveError: T
) {
	return deletePackageSessionCalendarEvent(ctx, {
		date: args.date,
		duration: details.packageRecord.duration,
		email: details.packageRecord.email,
		googleCalendarId: calendar.googleCalendarId,
		googleEventId: calendar.googleEventId,
		name: details.packageRecord.name,
		time: args.time
	})
		.mapErr((cleanupError) => logOrphanCalendarCleanupFailure(saveError, cleanupError))
		.andThen(() => failWithSaveError(saveError));
}

function logOrphanCalendarCleanupFailure<T>(saveError: T, cleanupError: { reason: string }) {
	console.error("Failed to compensate orphan package Calendar event", cleanupError);

	return saveError;
}

function recoverFailedPackageSessionSave(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	_now: number,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	details: PackageSessionRequestDetails,

	saveError: CreatePackageSessionError
) {
	if (!calendar.googleEventId || !calendar.googleCalendarId) {
		return err(saveError);
	}

	return compensateOrphanCalendarAndFail(ctx, args, details, calendar, saveError);
}

export function saveCreatedPackageSessionAfterCalendar(
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

	return saveCreatedPackageSession(ctx, saveArgs).orElse((saveError: CreatePackageSessionError) =>
		recoverFailedPackageSessionSave(ctx, args, now, calendar, details, saveError)
	);
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

function reservationFromPackageSessionSlot(
	reservationResult:
		| { outcome: "unavailable" }
		| { outcome: "reserved"; reservation: SessionReservation }
) {
	return reservationResult.outcome === "unavailable"
		? err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		: ok(reservationResult.reservation);
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
	}).andThen(reservationFromPackageSessionSlot);
}

function attachRescheduleCalendarContext(
	details: PackageRescheduleRequestDetails,
	reservation: SessionReservation,

	calendar: { googleCalendarId?: string; googleEventId?: string }
) {
	return { calendar, details, reservation };
}

function releaseReservationAfterCalendarFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	calendarError: ReschedulePackageSessionError
) {
	return clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(
		() => failWithCalendarRescheduleError(calendarError)
	);
}

function failWithCalendarRescheduleError(calendarError: ReschedulePackageSessionError) {
	return err(calendarError);
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
		.map((calendar: { googleCalendarId?: string; googleEventId?: string }) =>
			attachRescheduleCalendarContext(details, reservation, calendar)
		)
		.orElse((calendarError: ReschedulePackageSessionError) =>
			releaseReservationAfterCalendarFailure(ctx, args, reservation, calendarError)
		);
}

function toRescheduleBookingId(bookingId: Id<"bookings">) {
	return { bookingId };
}

function releaseReservationAfterRescheduleSaveFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	saveError: ReschedulePackageSessionError
) {
	return clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(
		() => failWithSaveError(saveError)
	);
}

export function savePackageSessionRescheduleAfterCalendar(
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
		.map(() => toRescheduleBookingId(args.bookingId))
		.orElse((saveError: ReschedulePackageSessionError) =>
			releaseReservationAfterRescheduleSaveFailure(ctx, args, reservation, saveError)
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

function keepCancelledPackageSession(cancelled: { cancelled: true; bookingId: Id<"bookings"> }) {
	return cancelled;
}

export function cleanupCancelledPackageDrive(
	ctx: ActionCtx,
	cancelled: { cancelled: true; bookingId: Id<"bookings"> }
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	return cleanupCancelledPackageSessionDrive(ctx, cancelled.bookingId).map(() =>
		keepCancelledPackageSession(cancelled)
	);
}
