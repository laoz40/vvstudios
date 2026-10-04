import { errAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { parseDurationMinutes } from "#convex/lib/sessions/sessionCalendarTime";

type DriveSchedulingError = { reason: "BOOKING_INVALID_DURATION" };

export function scheduleDriveSetup(
	ctx: MutationCtx,
	booking: {
		bookingId: Id<"bookings">;
		sessionStartAt: number;
		duration: string;
		packageId?: Id<"packages">;
	}
): ResultAsync<null, DriveSchedulingError> {
	const durationResult = parseDurationMinutes(booking.duration);

	if (durationResult.isErr()) return errAsync(durationResult.error);

	const runAt = booking.sessionStartAt + durationResult.value * 60_000;

	return okOrThrow(
		ctx.scheduler
			.runAt(Math.max(runAt, Date.now()), internal.googleCalendar.runScheduledDriveSetup, {
				bookingId: booking.bookingId,
				sessionStartAt: booking.sessionStartAt,
				duration: booking.duration
			})
			.then(() => null)
	);
}
