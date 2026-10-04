import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	searchBlobPatchForBooking,
	type BookingSearchPatchOverrides
} from "#convex/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { env } from "#convex/env";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import { sessionConsumesPackageCapacity } from "#convex/lib/packages/packageSessionCapacity";
import { okOrThrow } from "#convex/lib/result";
import {
	buildAdminSessionUpdatePatch,
	type AdminSessionTimingPatch
} from "#convex/lib/sessions/sessionAdminEdit";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	buildClientSessionRescheduleOptionalPatch,
	buildSessionCalendarConfirmationPatch
} from "#convex/lib/sessions/sessionSavePatch";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation,
	type SessionReservationBooking
} from "#convex/lib/sessions/sessionReservations";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/lib/sessions/sessionSchedulingArgs";

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

type AdminSessionDatabasePatch = AdminSessionTimingPatch & {
	googleCalendarId?: string;
	googleEventId?: string;
	status?: "confirmed";
	bookingConfirmedAt?: number;
	bookingFailureCode?: undefined;
	reservationCreatedAt?: undefined;
	reservationSessionStartAt?: undefined;
	reservationDuration?: undefined;
};

/** Loaded booking + computed patch + flags, before any write. */
export type ResolvedAdminSessionUpdate = {
	session: Doc<"bookings">;
	updatePatch: AdminSessionTimingPatch;
	timingChanged: boolean;
};

/** Booking that passed package/reservation checks, before patch. */
export type ValidatedClientSessionReschedule = {
	session: Doc<"bookings">;
	searchOverrides: BookingSearchPatchOverrides;
};

export function resolveAdminSessionUpdate(ctx: MutationCtx, args: SaveAdminSessionUpdateArgs) {
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session) =>
			buildAdminSessionUpdatePatch({
				session,
				timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
				values: args
			}).map((updatePatch) => ({ session, updatePatch }))
		)
		.andThen(({ session, updatePatch }) =>
			requireSessionReservation(session, args.reservation, now).map(() => ({
				session,
				updatePatch
			}))
		)
		.map(({ session, updatePatch }) => ({
			session,
			updatePatch,
			timingChanged:
				session.sessionStartAt !== updatePatch.sessionStartAt || session.duration !== args.duration
		}));
}

export function persistAdminSessionUpdate(
	ctx: MutationCtx,
	args: SaveAdminSessionUpdateArgs,
	resolved: ResolvedAdminSessionUpdate
) {
	const patch: AdminSessionDatabasePatch = {
		...resolved.updatePatch,
		...buildSessionCalendarConfirmationPatch({
			confirmBooking: args.confirmBooking,
			googleCalendarId: args.googleCalendarId,
			googleEventId: args.googleEventId
		})
	};

	if (args.reservation) {
		Object.assign(patch, clearedSessionReservationPatch);
	}

	return applySessionPatch(
		ctx,
		args.bookingId,
		resolved.session,
		patch,
		resolved.updatePatch
	).andThen(() =>
		scheduleDriveSetupWhenConfirmed(ctx, {
			confirmBooking: args.confirmBooking,
			duration: args.duration,
			session: resolved.session,
			sessionStartAt: resolved.updatePatch.sessionStartAt,
			timingChanged: resolved.timingChanged
		})
	);
}

export function validateClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session) => requirePackageSessionForReschedule(session, args.packageId))
		.andThen((session) =>
			requireSessionReservation(session, args.reservation, now).map(() => session)
		)
		.map((session) => ({
			session,
			searchOverrides: {
				addons: args.addons ?? session.addons,
				date: args.date,
				notes: args.notes ?? session.notes,
				service: args.service ?? session.service,
				time: args.time
			}
		}));
}

export function patchClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs,
	validated: ValidatedClientSessionReschedule
) {
	const session = validated.session;

	return applySessionPatch(
		ctx,
		args.bookingId,
		session,
		{
			date: args.date,
			time: args.time,
			sessionStartAt: args.sessionStartAt,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			...buildClientSessionRescheduleOptionalPatch(args),
			...clearedSessionReservationPatch
		},
		validated.searchOverrides
	).andThen(() =>
		scheduleDriveSetupWhenConfirmed(ctx, {
			confirmBooking: args.confirmBooking,
			duration: session.duration,
			session,
			sessionStartAt: args.sessionStartAt,
			timingChanged: true
		})
	);
}

export function schedulePackageAdjustmentAfterReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	if (args.packageId === undefined) {
		return okAsync(null);
	}

	return schedulePackageAdjustmentWhenSessionsComplete(ctx, args.packageId);
}
