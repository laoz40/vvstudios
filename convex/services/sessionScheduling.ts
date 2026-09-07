import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { scheduleDriveSetup } from "#convex/lib/driveScheduling";
import {
	buildAdminSessionUpdatePatch,
	type AdminSessionTimingPatch,
	type AdminSessionUpdateArgs
} from "#convex/lib/sessionAdminEdit";
import { getSessionFromDb } from "#convex/lib/sessionLookup";
import { buildClientSessionRescheduleOptionalPatch } from "#convex/lib/sessionRescheduleLinks";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "#convex/lib/sessionReservations";
import { sessionConsumesPackageCapacity } from "#convex/lib/packageScheduling";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { okOrThrow } from "#convex/lib/result";

type AdminSessionDatabasePatch = AdminSessionTimingPatch & {
	googleCalendarId?: string;
	googleEventId?: string;
	status?: "confirmed";
	bookingConfirmedAt?: number;
	bookingFailureCode?: undefined;
	reservationCreatedAt?: undefined;
	reservationSessionStartAt?: undefined;
	reservationDuration?: undefined;
};

export type SaveAdminSessionUpdateArgs = AdminSessionUpdateArgs & {
	googleCalendarId?: string;
	googleEventId?: string;
	confirmBooking?: boolean;
	reservation?: SessionReservation;
};

export type SaveClientSessionRescheduleArgs = {
	bookingId: Id<"bookings">;
	date: string;
	time: string;
	service?: string;
	addons?: BookingAddon[];
	notes?: string;
	sessionStartAt: number;
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
	packageId?: Id<"packages">;
	reservation: SessionReservation;
};

export function saveAdminSessionUpdateService(ctx: MutationCtx, args: SaveAdminSessionUpdateArgs) {
	return (
		getSessionFromDb(ctx, args.bookingId)
			.andThen((session) =>
				buildAdminSessionUpdatePatch({
					session,
					timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
					values: args
				}).map((updatePatch) => ({ session, updatePatch }))
			)
			// Check that this update still holds its reserved booking time.
			.andThen(({ session, updatePatch }) => {
				if (
					args.reservation !== undefined &&
					!sessionHasReservation(session, args.reservation, Date.now())
				) {
					return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
				}

				return ok({ session, updatePatch });
			})
			// Save the edit, Calendar linkage, confirmation state, and reservation cleanup together.
			.andThen(({ session, updatePatch }) => {
				const patch: AdminSessionDatabasePatch = { ...updatePatch };

				if (args.googleCalendarId) {
					patch.googleCalendarId = args.googleCalendarId;
				}
				if (args.googleEventId) {
					patch.googleEventId = args.googleEventId;
				}
				if (args.confirmBooking) {
					patch.status = "confirmed";
					patch.bookingConfirmedAt = Date.now();
					patch.bookingFailureCode = undefined;
				}
				if (args.reservation) {
					Object.assign(patch, clearedSessionReservationPatch);
				}

				return okOrThrow(ctx.db.patch(args.bookingId, patch)).andThen(() => {
					const nextStatus = args.confirmBooking ? "confirmed" : session.status;
					const timingChanged =
						session.sessionStartAt !== updatePatch.sessionStartAt ||
						session.duration !== args.duration;
					if (
						(nextStatus !== "confirmed" && nextStatus !== "email_failed") ||
						(!timingChanged && !args.confirmBooking)
					) {
						return ok(null);
					}

					return ResultAsync.fromSafePromise(
						scheduleDriveSetup(ctx, {
							bookingId: session._id,
							sessionStartAt: updatePatch.sessionStartAt,
							duration: args.duration,
							packageId: session.packageId
						})
					).andThen((scheduled) => scheduled);
				});
			})
	);
}

export function saveClientSessionRescheduleService(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs,
	schedulePackageAdjustment: (packageId: Id<"packages">) => Promise<Id<"_scheduled_functions">>
) {
	return (
		getSessionFromDb(ctx, args.bookingId)
			// For package reschedules, check that the session is active and belongs to the package.
			.andThen((session) => {
				if (
					args.packageId !== undefined &&
					(session.packageId !== args.packageId || !sessionConsumesPackageCapacity(session))
				) {
					return err({ reason: "BOOKING_NOT_FOUND" as const });
				}

				return ok(session);
			})
			// Check that this reschedule still holds its reserved booking time.
			.andThen((session) => {
				if (!sessionHasReservation(session, args.reservation, Date.now())) {
					return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
				}

				return ok(session);
			})
			// Save the new time and clear the old reminder and reservation state.
			.andThen((session) =>
				okOrThrow(
					ctx.db.patch(args.bookingId, {
						date: args.date,
						time: args.time,
						sessionStartAt: args.sessionStartAt,
						reminderEmailClaimedAt: undefined,
						reminderEmailSentAt: undefined,
						reminderEmailFailureCode: undefined,
						...buildClientSessionRescheduleOptionalPatch(args),
						...clearedSessionReservationPatch
					})
				).andThen(() => {
					const nextStatus = args.confirmBooking ? "confirmed" : session.status;
					if (nextStatus !== "confirmed" && nextStatus !== "email_failed") {
						return ok(null);
					}

					return ResultAsync.fromSafePromise(
						scheduleDriveSetup(ctx, {
							bookingId: session._id,
							sessionStartAt: args.sessionStartAt,
							duration: session.duration,
							packageId: session.packageId
						})
					).andThen((scheduled) => scheduled);
				})
			)
			// Recalculate the package adjustment only for package sessions.
			.andThen(() => {
				if (args.packageId === undefined) {
					return ok(null);
				}

				return okOrThrow(schedulePackageAdjustment(args.packageId).then(() => null));
			})
	);
}
