import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	searchBlobPatchForBooking,
	type BookingSearchPatchOverrides
} from "#convex/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { sessionConsumesPackageCapacity } from "#convex/lib/packages/packageSessionCapacity";
import { okOrThrow } from "#convex/lib/result";
import {
	sessionHasReservation,
	type SessionReservation,
	type SessionReservationBooking
} from "#convex/lib/sessions/sessionReservations";

export function requireSessionReservation(
	session: SessionReservationBooking,
	reservation: SessionReservation | undefined,
	now: number
): Result<null, { reason: "BOOKING_TIME_UNAVAILABLE" }> {
	if (reservation === undefined) {
		return ok(null);
	}

	if (!sessionHasReservation(session, reservation, now)) {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}

	return ok(null);
}

export function requirePackageSessionForReschedule(
	session: Doc<"bookings">,
	packageId?: Id<"packages">
): Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }> {
	if (packageId === undefined) {
		return ok(session);
	}

	if (session.packageId !== packageId || !sessionConsumesPackageCapacity(session)) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(session);
}

type SessionDriveSetupTarget = Pick<Doc<"bookings">, "_id" | "packageId" | "status">;

export function scheduleDriveSetupWhenConfirmed(
	ctx: MutationCtx,
	args: {
		confirmBooking?: boolean;
		duration: string;
		session: SessionDriveSetupTarget;
		sessionStartAt: number;
		timingChanged: boolean;
	}
): ResultAsync<null, { reason: "BOOKING_INVALID_DURATION" }> {
	const nextStatus = args.confirmBooking ? "confirmed" : args.session.status;

	if (
		(nextStatus !== "confirmed" && nextStatus !== "email_failed") ||
		(!args.timingChanged && !args.confirmBooking)
	) {
		return okAsync(null);
	}

	return okOrThrow(
		scheduleDriveSetup(ctx, {
			bookingId: args.session._id,
			duration: args.duration,
			packageId: args.session.packageId,
			sessionStartAt: args.sessionStartAt
		})
	).andThen((scheduled) => scheduled);
}

export function applySessionPatch(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	booking: Doc<"bookings">,
	patch: Partial<Doc<"bookings">>,
	searchOverrides: BookingSearchPatchOverrides = {}
) {
	return okOrThrow(
		searchBlobPatchForBooking(ctx, booking, searchOverrides).then((searchBlobPatch) =>
			ctx.db.patch("bookings", bookingId, { ...patch, ...searchBlobPatch }).then(() => null)
		)
	);
}
