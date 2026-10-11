import {
	createdPackageSessionSaveArgs,
	checkRateLimitForPackageSession,
	logOrphanCalendarCleanupFailure,
	reservationFromPackageSessionSlot
} from "#convex/packages/lib/sessionSchedulingSteps";

import type { ResultAsync } from "neverthrow";
import { errAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	cancelPackageSessionBooking,
	cleanupCancelledPackageSessionDrive,
	clearPackageSessionReservation,
	createPackageSessionCalendarEvent,
	deletePackageSessionCalendarEvent,
	deleteOrphanPackageSessionCalendarEvent,
	loadPackageRescheduleRequest,
	loadPackageSessionRequest,
	loadPackageUnscheduleRequest,
	reservePackageSessionSlot,
	saveCreatedPackageSession,
	savePackageSessionReschedule,
	updatePackageSessionCalendarEvent
} from "#convex/packages/lib/schedulingActionBoundaries";
import type {
	CreatePackageSessionError,
	ReschedulePackageSessionError,
	UnschedulePackageSessionError
} from "#convex/packages/lib/scheduling";
import {
	toPackageCalendarDetails,
	toPackageCalendarSession
} from "#convex/packages/lib/scheduling";
import type { ValidPackageByTokenError } from "#convex/packages/lib/lookup";
import type { PackageCalendarWriteError } from "#convex/googleCalendar/services/packageScheduling";
import type { GoogleCalendarWriteError } from "#convex/googleCalendar/lib/googleCalendarErrors";
import type {
	PackageRescheduleRequestDetails,
	PackageSessionRequestDetails,
	PackageUnscheduleRequestDetails
} from "#convex/packages/services/sessionMutations";

import type { SessionReservation } from "#convex/sessions/lib/reservations";
import type { BookingService } from "#/domain/booking/catalog";
import { getPackageSessionAddons } from "#/domain/booking/catalog";

type RecordingSpace = BookingService;

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
	}).map((calendar: { googleCalendarId?: string; googleEventId?: string }) => ({
		calendar,
		details
	}));
}

function compensateOrphanCalendarAndFail<T>(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	details: PackageSessionRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	saveError: T
) {
	return deleteOrphanPackageSessionCalendarEvent(ctx, {
		date: args.date,
		duration: details.packageRecord.duration,
		email: details.packageRecord.email,
		googleCalendarId: calendar.googleCalendarId,
		googleEventId: calendar.googleEventId,
		name: details.packageRecord.name,
		time: args.time
	})
		.mapErr((cleanupError) => logOrphanCalendarCleanupFailure(saveError, cleanupError))
		.andThen(() => errAsync(saveError));
}

export function saveCreatedPackageSessionAfterCalendar(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	details: PackageSessionRequestDetails
): ResultAsync<{ bookingId: Id<"bookings"> }, CreatePackageSessionError> {
	const saveArgs = createdPackageSessionSaveArgs(args, now, calendar);

	return saveCreatedPackageSession(ctx, saveArgs).orElse((saveError: CreatePackageSessionError) =>
		compensateOrphanCalendarAndFail(ctx, args, details, calendar, saveError)
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

function releaseReservationAfterCalendarFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	calendarError: ReschedulePackageSessionError
) {
	return clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(
		() => errAsync(calendarError)
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
		.map((calendar: { googleCalendarId?: string; googleEventId?: string }) => ({
			calendar,
			details,
			reservation
		}))
		.orElse((calendarError: ReschedulePackageSessionError) =>
			releaseReservationAfterCalendarFailure(ctx, args, reservation, calendarError)
		);
}

function releaseReservationAfterRescheduleSaveFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	saveError: ReschedulePackageSessionError
) {
	return clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation }).andThen(
		() => errAsync(saveError)
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
		.map(() => ({ bookingId: args.bookingId }))
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

export function cleanupCancelledPackageDrive(
	ctx: ActionCtx,
	cancelled: { cancelled: true; bookingId: Id<"bookings"> }
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	return cleanupCancelledPackageSessionDrive(ctx, cancelled.bookingId).map(() => cancelled);
}
