import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/drive/lib/driveScheduling";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "#convex/sessions/lib/reservations";

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

export type ConfirmedBookingDatabasePatch = {
	status: "confirmed";
	googleEventId?: string;
	googleCalendarId?: string;
	bookingConfirmedAt: number;
	bookingFailureCode: undefined;
	reservationCreatedAt?: undefined;
	reservationSessionStartAt?: undefined;
	reservationDuration?: undefined;
	receiptNumber?: string;
	searchBlob?: string;
	assignedEditorDisplayName?: string;
};

export function buildConfirmedBookingPatch(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	args: Pick<MarkBookingConfirmedArgs, "googleEventId" | "googleCalendarId">,
	confirmedAt: number
): ResultAsync<ConfirmedBookingDatabasePatch, never> {
	const confirmedPatch: ConfirmedBookingDatabasePatch = {
		status: "confirmed",
		googleEventId: args.googleEventId,
		googleCalendarId: args.googleCalendarId,
		bookingConfirmedAt: confirmedAt,
		bookingFailureCode: undefined,
		...clearedSessionReservationPatch
	};

	if (session.packageId !== undefined || session.receiptNumber) {
		return okAsync(confirmedPatch);
	}

	const receiptNumber = resolveBookingReceiptNumber(
		session,
		bookingReceiptPaidAt(session, confirmedAt)
	);

	return searchBlobPatchForBookingAsync(ctx, session, { receiptNumber }).map((searchBlobPatch) => ({
		...confirmedPatch,
		receiptNumber,
		...searchBlobPatch
	}));
}

export function patchConfirmedBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	session: Doc<"bookings">,
	patch: ConfirmedBookingDatabasePatch
): ResultAsync<Doc<"bookings">, never> {
	return okOrThrow(ctx.db.patch("bookings", bookingId, patch).then(() => session));
}

export function scheduleDriveSetupForConfirmedBooking(
	ctx: MutationCtx,
	session: Doc<"bookings">
): ResultAsync<null, { reason: "BOOKING_INVALID_DURATION" }> {
	return scheduleDriveSetup(ctx, {
		bookingId: session._id,
		sessionStartAt: session.sessionStartAt,
		duration: session.duration,
		packageId: session.packageId
	});
}
