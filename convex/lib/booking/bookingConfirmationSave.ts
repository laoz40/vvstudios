import { err, ok, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { okOrThrow } from "#convex/lib/result";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "#convex/lib/sessions/sessionReservations";

export type MarkBookingConfirmedArgs = {
	bookingId: Id<"bookings">;
	googleEventId?: string;
	googleCalendarId?: string;
	reservation: SessionReservation;
};

export function requireBookingConfirmationReservation(
	session: Doc<"bookings">,
	reservation: SessionReservation,
	now: number
): Result<Doc<"bookings">, { reason: "BOOKING_RESERVATION_MISMATCH" }> {
	if (!sessionHasReservation(session, reservation, now)) {
		return err({ reason: "BOOKING_RESERVATION_MISMATCH" });
	}

	return ok(session);
}

async function buildConfirmedBookingPatch(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	args: Pick<MarkBookingConfirmedArgs, "googleEventId" | "googleCalendarId">,
	confirmedAt: number
) {
	const confirmedPatch = {
		status: "confirmed" as const,
		googleEventId: args.googleEventId,
		googleCalendarId: args.googleCalendarId,
		bookingConfirmedAt: confirmedAt,
		bookingFailureCode: undefined,
		...clearedSessionReservationPatch
	};

	if (session.packageId !== undefined || session.receiptNumber) {
		return confirmedPatch;
	}

	const receiptNumber = resolveBookingReceiptNumber(
		session,
		bookingReceiptPaidAt(session, confirmedAt)
	);

	const searchBlobPatch = await searchBlobPatchForBooking(ctx, session, { receiptNumber });

	return { ...confirmedPatch, receiptNumber, ...searchBlobPatch };
}

export function persistConfirmedBooking(
	ctx: MutationCtx,
	args: MarkBookingConfirmedArgs,
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings">, never> {
	const confirmedAt = Date.now();

	return okOrThrow(
		buildConfirmedBookingPatch(ctx, session, args, confirmedAt).then((patch) =>
			ctx.db.patch("bookings", args.bookingId, patch).then(() => session)
		)
	);
}

export function scheduleDriveSetupForConfirmedBooking(
	ctx: MutationCtx,
	session: Doc<"bookings">
): ResultAsync<null, { reason: "BOOKING_INVALID_DURATION" }> {
	return okOrThrow(
		scheduleDriveSetup(ctx, {
			bookingId: session._id,
			sessionStartAt: session.sessionStartAt,
			duration: session.duration,
			packageId: session.packageId
		})
	).andThen((scheduled) => scheduled);
}
