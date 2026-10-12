import {
	createdPackageSessionSaveArgs,
	checkRateLimitForPackageSession,
	logOrphanCalendarCleanupFailure,
	reservationFromPackageSessionSlot
} from "#convex/packages/lib/sessionSchedulingSteps";

import { err, ok, safeTry } from "neverthrow";
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
import type { ReschedulePackageSessionError } from "#convex/packages/lib/scheduling";
import {
	toPackageCalendarDetails,
	toPackageCalendarSession
} from "#convex/packages/lib/scheduling";
import type {
	PackageRescheduleRequestDetails,
	PackageSessionRequestDetails,
	PackageUnscheduleRequestDetails
} from "#convex/packages/services/sessionMutations";

import type { SessionReservation } from "#convex/sessions/lib/reservations";
import type { BookingService } from "#/domain/booking/catalog";
import { getPackageSessionAddons } from "#/domain/booking/catalog";

export type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: BookingService;
	notes?: string;
	remotePodcast: boolean;
};

export type ReschedulePackageSessionArgs = PackageSessionArgs & { bookingId: Id<"bookings"> };

export type UnschedulePackageSessionArgs = { bookingId: Id<"bookings">; token: string };

export function loadPackageCreateRequestAndCheckRateLimit(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number
) {
	return safeTry(async function* () {
		const details = yield* loadPackageSessionRequest(ctx, {
			token: args.token,
			date: args.date,
			time: args.time,
			now
		});

		const validatedDetails = yield* checkRateLimitForPackageSession(ctx, details);

		return ok(validatedDetails);
	});
}

export function syncNewPackageSessionCalendar(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	details: PackageSessionRequestDetails
) {
	return safeTry(async function* () {
		const calendar = yield* createPackageSessionCalendarEvent(ctx, {
			session: null,
			details: toPackageCalendarDetails(args, details.packageRecord, details.eventBufferMinutes)
		});

		return ok({ calendar, details });
	});
}

function compensateOrphanCalendarAndFail<T>(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	details: PackageSessionRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	saveError: T
) {
	return safeTry(async function* () {
		yield* deleteOrphanPackageSessionCalendarEvent(ctx, {
			date: args.date,
			duration: details.packageRecord.duration,
			email: details.packageRecord.email,
			googleCalendarId: calendar.googleCalendarId,
			googleEventId: calendar.googleEventId,
			name: details.packageRecord.name,
			time: args.time
		}).mapErr((cleanupError) => logOrphanCalendarCleanupFailure(saveError, cleanupError));

		return err(saveError);
	});
}

export function saveCreatedPackageSessionAfterCalendar(
	ctx: ActionCtx,
	args: PackageSessionArgs,
	now: number,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	details: PackageSessionRequestDetails
) {
	const saveArgs = createdPackageSessionSaveArgs(args, now, calendar);

	return saveCreatedPackageSession(ctx, saveArgs).orElse((saveError) =>
		compensateOrphanCalendarAndFail(ctx, args, details, calendar, saveError)
	);
}

export function loadPackageRescheduleTarget(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	now: number
) {
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
	return safeTry(async function* () {
		const slot = yield* reservePackageSessionSlot(ctx, {
			bookingId: args.bookingId,
			duration: details.packageRecord.duration,
			eventBufferMinutes: details.eventBufferMinutes,
			sessionStartAt: details.sessionStartAt
		});

		const reservation = yield* reservationFromPackageSessionSlot(slot);

		return ok(reservation);
	});
}

function releaseReservationAfterCalendarFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	calendarError: ReschedulePackageSessionError
) {
	return safeTry(async function* () {
		yield* clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation });

		return err(calendarError);
	});
}

export function syncPackageRescheduleCalendar(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	details: PackageRescheduleRequestDetails,
	reservation: SessionReservation
) {
	return safeTry(async function* () {
		const calendar = yield* updatePackageSessionCalendarEvent(ctx, {
			session: toPackageCalendarSession(details.session),
			details: toPackageCalendarDetails(args, details.packageRecord, details.eventBufferMinutes)
		});

		return ok({ calendar, details, reservation });
	}).orElse((calendarError) =>
		releaseReservationAfterCalendarFailure(ctx, args, reservation, calendarError)
	);
}

function releaseReservationAfterRescheduleSaveFailure(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	reservation: SessionReservation,

	saveError: ReschedulePackageSessionError
) {
	return safeTry(async function* () {
		yield* clearPackageSessionReservation(ctx, { bookingId: args.bookingId, reservation });

		return err(saveError);
	});
}

export function savePackageSessionRescheduleAfterCalendar(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs,
	details: PackageRescheduleRequestDetails,
	calendar: { googleCalendarId?: string; googleEventId?: string },
	reservation: SessionReservation
) {
	return safeTry(async function* () {
		yield* savePackageSessionReschedule(ctx, {
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
		});

		return ok({ bookingId: args.bookingId });
	}).orElse((saveError) =>
		releaseReservationAfterRescheduleSaveFailure(ctx, args, reservation, saveError)
	);
}

export function loadPackageUnscheduleTarget(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs,
	now: number
) {
	return loadPackageUnscheduleRequest(ctx, { ...args, now });
}

export function clearPackageSessionCalendar(
	ctx: ActionCtx,
	details: PackageUnscheduleRequestDetails
) {
	return deletePackageSessionCalendarEvent(ctx, toPackageCalendarSession(details.session));
}

export function markPackageSessionCancelled(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs,
	now: number
) {
	return cancelPackageSessionBooking(ctx, { ...args, now });
}

export function cleanupCancelledPackageDrive(
	ctx: ActionCtx,
	cancelled: { cancelled: true; bookingId: Id<"bookings"> }
) {
	return safeTry(async function* () {
		yield* cleanupCancelledPackageSessionDrive(ctx, cancelled.bookingId);

		return ok(cancelled);
	});
}
