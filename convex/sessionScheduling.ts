import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { env } from "./env";
import { buildAdminSessionUpdatePatch } from "./lib/sessionAdminEdit";
import { getSessionFromDb } from "./lib/sessionLookup";
import { buildClientSessionRescheduleOptionalPatch } from "./lib/sessionRescheduleLinks";
import {
	sessionHasReservation,
	sessionReservationValidator,
	clearedSessionReservationPatch,
	reserveSessionTime,
	unreserveSessionTime
} from "./lib/sessionReservations";
import { sessionConsumesPackageCapacity } from "./lib/packageScheduling";

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
	handler: (ctx, args) => reserveSessionTime(ctx, args)
});

export const clearSessionReservation = internalMutation({
	args: { bookingId: v.id("bookings"), reservation: sessionReservationValidator },
	handler: (ctx, args) => unreserveSessionTime(ctx, args.bookingId, args.reservation)
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
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		remainingBalanceAmount: v.optional(v.number()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		confirmBooking: v.optional(v.boolean()),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}
		const [updatePatchError, updatePatch] = buildAdminSessionUpdatePatch({
			session,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
			values: args
		});

		if (updatePatchError !== null) {
			return err(updatePatchError);
		}

		if (
			args.reservation !== undefined &&
			!sessionHasReservation(session, args.reservation, Date.now())
		) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		// If Google Calendar event details changed, pass IDs here so session points at the current event.
		// Failed bookings can be promoted after a Calendar event is created.
		await ctx.db.patch(args.bookingId, {
			...updatePatch,
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
		});

		return ok({ saved: true });
	}
});

export const saveClientSessionReschedule = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		date: v.string(),
		time: v.string(),
		service: v.optional(v.string()),
		addons: v.optional(v.array(v.string())),
		notes: v.optional(v.string()),
		sessionStartAt: v.number(),
		confirmBooking: v.optional(v.boolean()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		multiBookingPackageId: v.optional(v.id("multiBookingPackages")),
		reservation: sessionReservationValidator
	},
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (
			bookingError === null &&
			args.multiBookingPackageId !== undefined &&
			(session.multiBookingPackageId !== args.multiBookingPackageId ||
				!sessionConsumesPackageCapacity(session))
		) {
			return err({ reason: "BOOKING_NOT_FOUND" as const });
		}

		if (bookingError !== null) {
			return err(bookingError);
		}

		if (!sessionHasReservation(session, args.reservation, Date.now())) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		await ctx.db.patch(args.bookingId, {
			date: args.date,
			time: args.time,
			sessionStartAt: args.sessionStartAt,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			...buildClientSessionRescheduleOptionalPatch(args),
			...clearedSessionReservationPatch
		});

		if (args.multiBookingPackageId !== undefined) {
			await ctx.scheduler.runAfter(
				0,
				internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
				{ multiBookingId: args.multiBookingPackageId }
			);
		}

		return ok({ saved: true });
	}
});
