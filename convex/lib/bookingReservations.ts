import { v } from "convex/values";
import { err, ok } from "../../src/lib/result";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { doBookingWindowsOverlap } from "./bookingCalendarTime";

export const SLOT_RESERVATION_TTL_MS = 10 * 60 * 1000;
const MAX_BOOKING_DURATION_MINUTES = 180;

export const bookingReservationValidator = v.object({
	reservedAt: v.number(),
	sessionStartAt: v.number(),
	duration: v.string()
});

export type BookingReservation = { reservedAt: number; sessionStartAt: number; duration: string };

function getReservedTarget(booking: Doc<"bookings">) {
	if (booking.reservationCreatedAt === undefined) return null;

	return {
		reservedAt: booking.reservationCreatedAt,
		sessionStartAt: booking.reservationSessionStartAt ?? booking.sessionStartAt,
		duration: booking.reservationDuration ?? booking.duration
	};
}

export function bookingHasReservation(
	booking: Doc<"bookings">,
	expected: BookingReservation,
	now?: number
) {
	const reservation = getReservedTarget(booking);

	return (
		reservation !== null &&
		reservation.reservedAt === expected.reservedAt &&
		reservation.sessionStartAt === expected.sessionStartAt &&
		reservation.duration === expected.duration &&
		(now === undefined || now - reservation.reservedAt < SLOT_RESERVATION_TTL_MS)
	);
}

export const clearedBookingReservationPatch = {
	reservationCreatedAt: undefined,
	reservationSessionStartAt: undefined,
	reservationDuration: undefined
};

export async function reserveBookingTime(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		now: number;
		sessionStartAt: number;
	}
) {
	// Load the booking being moved.
	const booking = await ctx.db.get(args.bookingId);

	if (booking === null) {
		return err({ reason: "BOOKING_NOT_FOUND" as const });
	}

	// Work out how far around the new time we need to search.
	const searchPaddingMs = (MAX_BOOKING_DURATION_MINUTES + args.eventBufferMinutes) * 60 * 1000;
	const searchStartAt = args.sessionStartAt - searchPaddingMs;
	const searchEndAt = args.sessionStartAt + searchPaddingMs;
	const confirmedStatuses = ["confirmed", "email_failed"] as const;
	const confirmedBookings: Doc<"bookings">[] = [];

	// Find nearby bookings that already use calendar time.
	for (const status of confirmedStatuses) {
		const nearbyBookings = ctx.db
			.query("bookings")
			.withIndex("by_status_and_sessionStartAt", (query) =>
				query
					.eq("status", status)
					.gte("sessionStartAt", searchStartAt)
					.lte("sessionStartAt", searchEndAt)
			);
		for await (const confirmedBooking of nearbyBookings) {
			confirmedBookings.push(confirmedBooking);
		}
	}

	// Find new times reserved by booking updates that are still running.
	// Expired reservations are ignored.
	const activeReservations: Doc<"bookings">[] = [];
	for await (const candidate of ctx.db
		.query("bookings")
		.withIndex("by_reservationCreatedAt", (query) =>
			query.gt("reservationCreatedAt", args.now - SLOT_RESERVATION_TTL_MS)
		)) {
		activeReservations.push(candidate);
	}

	// Check whether a saved booking already uses the requested time.
	// Ignore this booking because it is allowed to move away from its old time.
	const conflictingConfirmedBooking = confirmedBookings.some(
		(candidate) =>
			candidate._id !== booking._id &&
			doBookingWindowsOverlap({
				firstDuration: args.duration,
				firstStartAt: args.sessionStartAt,
				secondDuration: candidate.duration,
				secondStartAt: candidate.sessionStartAt,
				eventBufferMinutes: args.eventBufferMinutes
			})
	);
	// Check whether another booking update already reserved the requested time.
	const conflictingReservation = activeReservations.some((candidate) => {
		if (candidate._id === booking._id) return false;
		const target = getReservedTarget(candidate);
		if (target === null) return false;

		return doBookingWindowsOverlap({
			firstDuration: args.duration,
			firstStartAt: args.sessionStartAt,
			secondDuration: target.duration,
			secondStartAt: target.sessionStartAt,
			eventBufferMinutes: args.eventBufferMinutes
		});
	});

	// The new time cannot be used if either check found a conflict.
	if (conflictingConfirmedBooking || conflictingReservation) {
		return ok({ outcome: "unavailable" as const });
	}

	// Reserve the new time while the booking and Google Calendar are updated.
	// The reservation uses the current time as its id. Add 1 if the previous reservation
	// has the same id, so an older request cannot remove this new reservation by mistake.
	const reservedAt = Math.max(args.now, (booking.reservationCreatedAt ?? 0) + 1);
	const reservation = { reservedAt, sessionStartAt: args.sessionStartAt, duration: args.duration };
	await ctx.db.patch(booking._id, {
		reservationCreatedAt: reservation.reservedAt,
		reservationSessionStartAt: reservation.sessionStartAt,
		reservationDuration: reservation.duration
	});

	return ok({ outcome: "reserved" as const, reservation });
}

export async function unreserveBookingTime(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: BookingReservation
) {
	// Remove the reservation only if it still belongs to this request.
	const booking = await ctx.db.get(bookingId);

	if (booking === null) return ok({ cleared: false as const });
	if (!bookingHasReservation(booking, expected)) {
		return ok({ cleared: false as const });
	}

	await ctx.db.patch(bookingId, clearedBookingReservationPatch);
	return ok({ cleared: true as const });
}
