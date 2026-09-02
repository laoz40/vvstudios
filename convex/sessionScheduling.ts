import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
	sessionReservationValidator,
	reserveSessionTime,
	unreserveSessionTime
} from "./lib/sessionReservations";
import { bookingAddonQuantitiesValidator } from "./lib/bookingAddonQuantities";
import {
	saveAdminSessionUpdateService,
	saveClientSessionRescheduleService
} from "./services/sessionScheduling";

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
		addons: v.array(v.string()),
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		remainingBalanceAmount: v.optional(v.number()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		confirmBooking: v.optional(v.boolean()),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => saveAdminSessionUpdateService(ctx, args).match(tupleOk, tupleErr)
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
	handler: (ctx, args) =>
		saveClientSessionRescheduleService(
			ctx,
			args,
			(multiBookingId): Promise<unknown> =>
				ctx.scheduler.runAfter(
					0,
					internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
					{ multiBookingId }
				)
		).match(tupleOk, tupleErr)
});
