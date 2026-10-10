import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation } from "#convex/_generated/server";
import { sessionReservationValidator } from "#convex/sessions/services/reservationValidators";
import { reserveSessionTime, unreserveSessionTime } from "#convex/sessions/services/reservations";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/services/formValidators";
import {
	writeAdminSessionUpdateWithDriveSetup,
	patchClientSessionReschedule,
	resolveAdminSessionUpdate,
	schedulePackageAdjustmentAfterReschedule,
	validateClientSessionReschedule
} from "#convex/sessions/services/schedulingSave";

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
	handler: (ctx, args) =>
		resolveAdminSessionUpdate(ctx, args)
			.andThen((resolved) => writeAdminSessionUpdateWithDriveSetup(ctx, args, resolved))
			.match(tupleOk, tupleErr)
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
	handler: (ctx, args) =>
		validateClientSessionReschedule(ctx, args)
			.andThen((validated) => patchClientSessionReschedule(ctx, args, validated))
			.andThen(() => schedulePackageAdjustmentAfterReschedule(ctx, args))
			.match(tupleOk, tupleErr)
});
