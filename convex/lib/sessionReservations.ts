import { v } from "convex/values";
import { err, ok, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { doSessionWindowsOverlap } from "./sessionCalendarTime";

export const SLOT_RESERVATION_TTL_MS = 10 * 60 * 1000;
const MAX_BOOKING_DURATION_MINUTES = 180;

export const sessionReservationValidator = v.object({
	reservedAt: v.number(),
	sessionStartAt: v.number(),
	duration: v.string()
});

export type SessionReservation = { reservedAt: number; sessionStartAt: number; duration: string };

function getReservedTarget(session: Doc<"bookings">) {
	if (session.reservationCreatedAt === undefined) return null;

	return {
		reservedAt: session.reservationCreatedAt,
		sessionStartAt: session.reservationSessionStartAt ?? session.sessionStartAt,
		duration: session.reservationDuration ?? session.duration
	};
}

export function sessionHasReservation(
	session: Doc<"bookings">,
	expected: SessionReservation,
	now?: number
) {
	const reservation = getReservedTarget(session);

	return (
		reservation !== null &&
		reservation.reservedAt === expected.reservedAt &&
		reservation.sessionStartAt === expected.sessionStartAt &&
		reservation.duration === expected.duration &&
		(now === undefined || now - reservation.reservedAt < SLOT_RESERVATION_TTL_MS)
	);
}

export const clearedSessionReservationPatch = {
	reservationCreatedAt: undefined,
	reservationSessionStartAt: undefined,
	reservationDuration: undefined
};

export async function reserveSessionTime(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		duration: string;
		eventBufferMinutes: number;
		now: number;
		sessionStartAt: number;
	}
): Promise<
	Result<
		{ outcome: "unavailable" } | { outcome: "reserved"; reservation: SessionReservation },
		{ reason: "BOOKING_NOT_FOUND" }
	>
> {
	// Load the session being moved.
	const session = await ctx.db.get(args.bookingId);

	if (session === null) {
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

	// Find new times reserved by session updates that are still running.
	// Expired reservations are ignored.
	const activeReservations: Doc<"bookings">[] = [];
	for await (const candidate of ctx.db
		.query("bookings")
		.withIndex("by_reservationCreatedAt", (query) =>
			query.gt("reservationCreatedAt", args.now - SLOT_RESERVATION_TTL_MS)
		)) {
		activeReservations.push(candidate);
	}

	// Check whether a saved session already uses the requested time.
	// Ignore this session because it is allowed to move away from its old time.
	const conflictingConfirmedBooking = confirmedBookings.some(
		(candidate) =>
			candidate._id !== session._id &&
			doSessionWindowsOverlap({
				firstDuration: args.duration,
				firstStartAt: args.sessionStartAt,
				secondDuration: candidate.duration,
				secondStartAt: candidate.sessionStartAt,
				eventBufferMinutes: args.eventBufferMinutes
			})
	);
	// Check whether another session update already reserved the requested time.
	const conflictingReservation = activeReservations.some((candidate) => {
		if (candidate._id === session._id) return false;
		const target = getReservedTarget(candidate);
		if (target === null) return false;

		return doSessionWindowsOverlap({
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

	// Reserve the new time while the session and Google Calendar are updated.
	// The reservation uses the current time as its id. Add 1 if the previous reservation
	// has the same id, so an older request cannot remove this new reservation by mistake.
	const reservedAt = Math.max(args.now, (session.reservationCreatedAt ?? 0) + 1);
	const reservation = { reservedAt, sessionStartAt: args.sessionStartAt, duration: args.duration };
	await ctx.db.patch(session._id, {
		reservationCreatedAt: reservation.reservedAt,
		reservationSessionStartAt: reservation.sessionStartAt,
		reservationDuration: reservation.duration
	});

	return ok({ outcome: "reserved" as const, reservation });
}

export async function unreserveSessionTime(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: SessionReservation
): Promise<Result<{ cleared: boolean }, never>> {
	// Remove the reservation only if it still belongs to this request.
	const session = await ctx.db.get(bookingId);

	if (session === null) return ok({ cleared: false as const });
	if (!sessionHasReservation(session, expected)) {
		return ok({ cleared: false as const });
	}

	await ctx.db.patch(bookingId, clearedSessionReservationPatch);
	return ok({ cleared: true as const });
}
