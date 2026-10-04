import { ok } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation } from "#convex/_generated/server";
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
import {
	clearedSessionReservationPatch,
	sessionReservationValidator,
	reserveSessionTime,
	unreserveSessionTime
} from "#convex/lib/sessions/sessionReservations";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import {
	applySessionPatch,
	requirePackageSessionForReschedule,
	requireSessionReservation,
	scheduleDriveSetupWhenConfirmed
} from "#convex/lib/sessions/sessionSchedulingSave";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";

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

// Reserve a target before any Calendar write. The shared helper checks confirmed
// bookings and reservations from every session workflow in the same transaction.
export const reserveSessionReservation = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		sessionStartAt: v.number(),
		duration: v.string(),
		eventBufferMinutes: v.number(),
		now: v.number()
	},
	handler: async (ctx, args) => (await reserveSessionTime(ctx, args)).match(tupleOk, tupleErr)
});

export const clearSessionReservation = internalMutation({
	args: { bookingId: v.id("bookings"), reservation: sessionReservationValidator },
	handler: async (ctx, args) =>
		(await unreserveSessionTime(ctx, args.bookingId, args.reservation)).match(tupleOk, tupleErr)
});

export const saveAdminSessionUpdate = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		confirmBooking: v.optional(v.boolean()),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => {
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
					session.sessionStartAt !== updatePatch.sessionStartAt ||
					session.duration !== args.duration;

				return applySessionPatch(ctx, args.bookingId, session, patch, updatePatch).andThen(() =>
					scheduleDriveSetupWhenConfirmed(ctx, {
						confirmBooking: args.confirmBooking,
						duration: args.duration,
						session,
						sessionStartAt: updatePatch.sessionStartAt,
						timingChanged
					})
				);
			})
			.match(tupleOk, tupleErr);
	}
});

export const saveClientSessionReschedule = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		date: v.string(),
		time: v.string(),
		service: v.optional(v.string()),
		addons: v.optional(bookingAddonsValidator),
		notes: v.optional(v.string()),
		sessionStartAt: v.number(),
		confirmBooking: v.optional(v.boolean()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		packageId: v.optional(v.id("packages")),
		reservation: sessionReservationValidator
	},
	handler: (ctx, args) => {
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
			})
			.match(tupleOk, tupleErr);
	}
});
