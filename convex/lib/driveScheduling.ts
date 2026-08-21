import { err, type Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { parseDurationMinutes } from "#convex/lib/sessionCalendarTime";

type DriveSchedulingError = { reason: "BOOKING_INVALID_DURATION" } | { reason: "UNEXPECTED_ERROR" };

export async function scheduleDriveSetup(
	ctx: MutationCtx,
	booking: {
		bookingId: Id<"bookings">;
		sessionStartAt: number;
		duration: string;
		multiBookingPackageId?: Id<"multiBookingPackages">;
	}
): Promise<Result<null, DriveSchedulingError>> {
	if (booking.multiBookingPackageId !== undefined) {
		return okOrThrow(Promise.resolve(null));
	}

	const durationResult = parseDurationMinutes(booking.duration);
	if (durationResult.isErr()) return err(durationResult.error);

	const runAt = booking.sessionStartAt + durationResult.value * 60_000;
	return await okOrThrow(
		ctx.scheduler
			.runAt(Math.max(runAt, Date.now()), internal.googleCalendar.runScheduledDriveSetup, {
				bookingId: booking.bookingId,
				sessionStartAt: booking.sessionStartAt,
				duration: booking.duration
			})
			.then(() => null)
	);
}
