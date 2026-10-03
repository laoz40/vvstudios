import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import {
	buildAdminSessionUpdatePatch,
	type AdminSessionTimingPatch
} from "#convex/lib/sessions/sessionAdminEdit";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	buildClientSessionRescheduleOptionalPatch,
	buildSessionCalendarConfirmationPatch
} from "#convex/lib/sessions/sessionSavePatch";
import {
	clearedSessionReservationPatch,
	sessionHasReservation
} from "#convex/lib/sessions/sessionReservations";
import { sessionConsumesPackageCapacity } from "#convex/lib/packages/packageScheduling";
import { okOrThrow } from "#convex/lib/result";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/lib/sessions/sessionSchedulingArgs";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearch/adminSearchBlob";

export type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/lib/sessions/sessionSchedulingArgs";

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
				const patch: AdminSessionDatabasePatch = {
					...updatePatch,
					...buildSessionCalendarConfirmationPatch({
						confirmBooking: args.confirmBooking,
						googleCalendarId: args.googleCalendarId,
						googleEventId: args.googleEventId
					})
				};

				if (args.reservation) {
					Object.assign(patch, clearedSessionReservationPatch);
				}

				return okOrThrow(
					searchBlobPatchForBooking(ctx, session, updatePatch).then((searchBlobPatch) =>
						ctx.db.patch(args.bookingId, { ...patch, ...searchBlobPatch }).then(() => null)
					)
				).andThen(() => {
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

					return okOrThrow(
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
					searchBlobPatchForBooking(ctx, {
						...session,
						date: args.date,
						time: args.time,
						service: args.service ?? session.service,
						addons: args.addons ?? session.addons,
						notes: args.notes ?? session.notes
					}).then((searchBlobPatch) =>
						ctx.db.patch(args.bookingId, {
							date: args.date,
							time: args.time,
							sessionStartAt: args.sessionStartAt,
							reminderEmailClaimedAt: undefined,
							reminderEmailSentAt: undefined,
							reminderEmailFailureCode: undefined,
							...buildClientSessionRescheduleOptionalPatch(args),
							...clearedSessionReservationPatch,
							...searchBlobPatch
						})
					)
				).andThen(() => {
					const nextStatus = args.confirmBooking ? "confirmed" : session.status;

					if (nextStatus !== "confirmed" && nextStatus !== "email_failed") {
						return ok(null);
					}

					return okOrThrow(
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
