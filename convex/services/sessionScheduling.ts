import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { scheduleDriveSetup } from "#convex/lib/driveScheduling";
import {
	buildAdminSessionUpdatePatch,
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
import { okOrThrow } from "#convex/lib/result";

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
	addons?: string[];
	notes?: string;
	sessionStartAt: number;
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
	multiBookingPackageId?: Id<"multiBookingPackages">;
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
			.andThen(({ session, updatePatch }) =>
				okOrThrow(
					ctx.db
						.patch(args.bookingId, {
							...updatePatch,
							// Keep the booking linked to the current Calendar event after an edit.
							...(args.googleCalendarId ? { googleCalendarId: args.googleCalendarId } : {}),
							...(args.googleEventId ? { googleEventId: args.googleEventId } : {}),
							...(args.confirmBooking
								? {
										status: "confirmed" as const,
										bookingConfirmedAt: Date.now(),
										bookingFailureCode: undefined
									}
								: {}),
							...(args.reservation ? clearedSessionReservationPatch : {})
						})
						.then(async () => {
							if (!args.confirmBooking) return;
							await scheduleDriveSetup(ctx, {
								bookingId: session._id,
								sessionStartAt: updatePatch.sessionStartAt,
								duration: args.duration,
								multiBookingPackageId: session.multiBookingPackageId
							});
						})
						.then(() => null)
				)
			)
	);
}

export function saveClientSessionRescheduleService(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs,
	schedulePackageAdjustment: (multiBookingId: Id<"multiBookingPackages">) => Promise<unknown>
) {
	return (
		getSessionFromDb(ctx, args.bookingId)
			// For package reschedules, check that the session is active and belongs to the package.
			.andThen((session) => {
				if (
					args.multiBookingPackageId !== undefined &&
					(session.multiBookingPackageId !== args.multiBookingPackageId ||
						!sessionConsumesPackageCapacity(session))
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
			.andThen(() =>
				okOrThrow(
					ctx.db
						.patch(args.bookingId, {
							date: args.date,
							time: args.time,
							sessionStartAt: args.sessionStartAt,
							reminderEmailClaimedAt: undefined,
							reminderEmailSentAt: undefined,
							reminderEmailFailureCode: undefined,
							...buildClientSessionRescheduleOptionalPatch(args),
							...clearedSessionReservationPatch
						})
						.then(() => null)
				)
			)
			// Recalculate the package adjustment only for package sessions.
			.andThen(() => {
				if (args.multiBookingPackageId === undefined) {
					return ok(null);
				}

				return okOrThrow(schedulePackageAdjustment(args.multiBookingPackageId).then(() => null));
			})
	);
}
