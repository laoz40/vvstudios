import { okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { BookingSearchPatchOverrides } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { env } from "#convex/env";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/packages/lib/adjustmentScheduling";
import {
	buildAdminSessionUpdatePatch,
	type AdminSessionTimingPatch
} from "#convex/sessions/lib/adminEdit";
import {
	buildClientSessionRescheduleOptionalPatch,
	buildSessionCalendarConfirmationPatch
} from "#convex/sessions/lib/savePatch";
import { clearedSessionReservationPatch } from "#convex/sessions/lib/reservations";
import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/sessions/lib/schedulingArgs";
import {
	writeSessionBookingPatchWithDriveSetup,
	requirePackageSessionForReschedule,
	requireSessionReservation
} from "#convex/sessions/lib/schedulingSave";
import { getSessionFromDb } from "#convex/sessions/services/lookup";

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

function adminSessionUpdatePatchPairStep(
	session: Doc<"bookings">,
	updatePatch: AdminSessionTimingPatch
) {
	return { session, updatePatch };
}

function adminUpdatePatchForSessionStep(
	args: SaveAdminSessionUpdateArgs,
	session: Doc<"bookings">
) {
	return buildAdminSessionUpdatePatch({
		session,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		values: args
	}).map((updatePatch: AdminSessionTimingPatch) =>
		adminSessionUpdatePatchPairStep(session, updatePatch)
	);
}

function retainAdminSessionUpdatePairStep(pair: {
	session: Doc<"bookings">;
	updatePatch: AdminSessionTimingPatch;
}) {
	return pair;
}

function requireAdminReservationStep(
	args: SaveAdminSessionUpdateArgs,
	now: number,
	{ session, updatePatch }: { session: Doc<"bookings">; updatePatch: AdminSessionTimingPatch }
) {
	return requireSessionReservation(session, args.reservation, now).map(() =>
		retainAdminSessionUpdatePairStep({ session, updatePatch })
	);
}

function resolvedAdminSessionUpdateStep(
	args: SaveAdminSessionUpdateArgs,
	{ session, updatePatch }: { session: Doc<"bookings">; updatePatch: AdminSessionTimingPatch }
) {
	return {
		session,
		updatePatch,
		timingChanged:
			session.sessionStartAt !== updatePatch.sessionStartAt || session.duration !== args.duration
	};
}

export function resolveAdminSessionUpdate(ctx: MutationCtx, args: SaveAdminSessionUpdateArgs) {
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session: Doc<"bookings">) => adminUpdatePatchForSessionStep(args, session))
		.andThen((_value) => requireAdminReservationStep(args, now, _value))
		.map((_value) => resolvedAdminSessionUpdateStep(args, _value));
}

export function writeAdminSessionUpdateWithDriveSetup(
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

	return writeSessionBookingPatchWithDriveSetup({
		ctx,
		bookingId: args.bookingId,
		booking: resolved.session,
		patch,
		searchOverrides: resolved.updatePatch,
		driveSetup: {
			confirmBooking: args.confirmBooking,
			duration: args.duration,
			session: resolved.session,
			sessionStartAt: resolved.updatePatch.sessionStartAt,
			timingChanged: resolved.timingChanged
		}
	});
}

function validatedClientRescheduleSearchOverridesStep(
	args: SaveClientSessionRescheduleArgs,
	session: Doc<"bookings">
) {
	return {
		session,
		searchOverrides: {
			addons: args.addons ?? session.addons,
			date: args.date,
			notes: args.notes ?? session.notes,
			service: args.service ?? session.service,
			time: args.time
		}
	};
}

function requireClientRescheduleReservationStep(
	args: SaveClientSessionRescheduleArgs,
	now: number,

	session: Doc<"bookings">
) {
	return requireSessionReservation(session, args.reservation, now).map(() =>
		retainSessionStep(session)
	);
}

function retainSessionStep(session: Doc<"bookings">) {
	return session;
}

function requirePackageSessionForRescheduleStep(
	args: SaveClientSessionRescheduleArgs,
	session: Doc<"bookings">
) {
	return requirePackageSessionForReschedule(session, args.packageId);
}

export function validateClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	const now = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session: Doc<"bookings">) => requirePackageSessionForRescheduleStep(args, session))
		.andThen((session: Doc<"bookings">) =>
			requireClientRescheduleReservationStep(args, now, session)
		)
		.map((session: Doc<"bookings">) => validatedClientRescheduleSearchOverridesStep(args, session));
}

export function patchClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs,
	validated: ValidatedClientSessionReschedule
) {
	const session = validated.session;

	return writeSessionBookingPatchWithDriveSetup({
		ctx,
		bookingId: args.bookingId,
		booking: session,
		patch: {
			date: args.date,
			time: args.time,
			sessionStartAt: args.sessionStartAt,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			...buildClientSessionRescheduleOptionalPatch(args),
			...clearedSessionReservationPatch
		},
		searchOverrides: validated.searchOverrides,
		driveSetup: {
			confirmBooking: args.confirmBooking,
			duration: session.duration,
			session,
			sessionStartAt: args.sessionStartAt,
			timingChanged: true
		}
	});
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
