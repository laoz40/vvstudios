import { ok } from "neverthrow";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import {
	buildAdminSessionUpdatePatch,
	type AdminSessionTimingPatch
} from "#convex/lib/sessions/sessionAdminEdit";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	buildClientSessionRescheduleOptionalPatch,
	buildSessionCalendarConfirmationPatch
} from "#convex/lib/sessions/sessionSavePatch";
import { clearedSessionReservationPatch } from "#convex/lib/sessions/sessionReservations";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import {
	applySessionPatch,
	requirePackageSessionForReschedule,
	requireSessionReservation,
	scheduleDriveSetupWhenConfirmed
} from "#convex/lib/sessions/sessionSchedulingSave";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/lib/sessions/sessionSchedulingArgs";

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
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session) =>
			buildAdminSessionUpdatePatch({
				session,
				timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
				values: args
			}).map((updatePatch) => ({ session, updatePatch }))
		)
		.andThen(({ session, updatePatch }) =>
			requireSessionReservation(session, args.reservation, now).map(() => ({
				session,
				updatePatch
			}))
		)
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

			const timingChanged =
				session.sessionStartAt !== updatePatch.sessionStartAt || session.duration !== args.duration;

			return applySessionPatch(ctx, args.bookingId, session, patch, updatePatch).andThen(() =>
				scheduleDriveSetupWhenConfirmed(ctx, {
					confirmBooking: args.confirmBooking,
					duration: args.duration,
					session,
					sessionStartAt: updatePatch.sessionStartAt,
					timingChanged
				})
			);
		});
}

export function saveClientSessionRescheduleService(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session) => requirePackageSessionForReschedule(session, args.packageId))
		.andThen((session) =>
			requireSessionReservation(session, args.reservation, now).map(() => session)
		)
		.andThen((session) => {
			const searchOverrides = {
				addons: args.addons ?? session.addons,
				date: args.date,
				notes: args.notes ?? session.notes,
				service: args.service ?? session.service,
				time: args.time
			};

			return applySessionPatch(
				ctx,
				args.bookingId,
				session,
				{
					date: args.date,
					time: args.time,
					sessionStartAt: args.sessionStartAt,
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined,
					...buildClientSessionRescheduleOptionalPatch(args),
					...clearedSessionReservationPatch
				},
				searchOverrides
			).andThen(() =>
				scheduleDriveSetupWhenConfirmed(ctx, {
					confirmBooking: args.confirmBooking,
					duration: session.duration,
					session,
					sessionStartAt: args.sessionStartAt,
					timingChanged: true
				})
			);
		})
		.andThen(() => {
			if (args.packageId === undefined) {
				return ok(null);
			}

			return schedulePackageAdjustmentWhenSessionsComplete(ctx, args.packageId);
		});
}
