import { err, ok, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { doSessionWindowsOverlap } from "#convex/lib/sessions/sessionCalendarTime";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
import {
	collectActiveReservationBookings,
	collectConfirmedBookingsInWindow,
	clearBookingReservationFields,
	writeBookingReservationFields
} from "#convex/lib/sessions/sessionReservationDb";
import {
	getReservedTarget,
	sessionHasReservation,
	SLOT_RESERVATION_TTL_MS,
	type SessionReservation
} from "#convex/lib/sessions/sessionReservations";

const MAX_BOOKING_DURATION_MINUTES = 180;

function reservationConflictsWithSlot(args: {
	session: Doc<"bookings">;
	duration: string;
	sessionStartAt: number;
	eventBufferMinutes: number;
	confirmedBookings: Doc<"bookings">[];
	activeReservations: Doc<"bookings">[];
}) {
	const conflictingConfirmedBooking = args.confirmedBookings.some(
		(candidate) =>
			candidate._id !== args.session._id &&
			doSessionWindowsOverlap({
				firstDuration: args.duration,
				firstStartAt: args.sessionStartAt,
				secondDuration: candidate.duration,
				secondStartAt: candidate.sessionStartAt,
				eventBufferMinutes: args.eventBufferMinutes
			})
	);

	const conflictingReservation = args.activeReservations.some((candidate) => {
		if (candidate._id === args.session._id) return false;
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

	return conflictingConfirmedBooking || conflictingReservation;
}

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
	const sessionResult = await getSessionFromDb(ctx, args.bookingId);

	if (sessionResult.isErr()) {
		return err(sessionResult.error);
	}

	const session = sessionResult.value;

	const searchPaddingMs = (MAX_BOOKING_DURATION_MINUTES + args.eventBufferMinutes) * 60 * 1000;
	const searchStartAt = args.sessionStartAt - searchPaddingMs;
	const searchEndAt = args.sessionStartAt + searchPaddingMs;

	const confirmedBookings = await collectConfirmedBookingsInWindow(ctx, {
		searchStartAt,
		searchEndAt
	});

	const activeReservations = await collectActiveReservationBookings(
		ctx,
		args.now - SLOT_RESERVATION_TTL_MS
	);

	if (
		reservationConflictsWithSlot({
			session,
			duration: args.duration,
			sessionStartAt: args.sessionStartAt,
			eventBufferMinutes: args.eventBufferMinutes,
			confirmedBookings,
			activeReservations
		})
	) {
		return ok({ outcome: "unavailable" as const });
	}

	const reservedAt = Math.max(args.now, (session.reservationCreatedAt ?? 0) + 1);
	const reservation = { reservedAt, sessionStartAt: args.sessionStartAt, duration: args.duration };

	const writeResult = await writeBookingReservationFields(ctx, session._id, {
		reservationCreatedAt: reservation.reservedAt,
		reservationSessionStartAt: reservation.sessionStartAt,
		reservationDuration: reservation.duration
	});

	if (writeResult.isErr()) {
		return err({ reason: "BOOKING_NOT_FOUND" as const });
	}

	return ok({ outcome: "reserved" as const, reservation });
}

export async function unreserveSessionTime(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: SessionReservation
): Promise<Result<{ cleared: boolean }, never>> {
	const sessionResult = await getSessionFromDb(ctx, bookingId);

	if (sessionResult.isErr() || !sessionHasReservation(sessionResult.value, expected)) {
		return ok({ cleared: false as const });
	}

	await clearBookingReservationFields(ctx, bookingId);

	return ok({ cleared: true as const });
}
