import { ok, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { BookingSearchPatchOverrides } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";

import { type AdminSessionTimingPatch } from "#convex/sessions/lib/adminEdit";

import type {
	SaveAdminSessionUpdateArgs,
	SaveClientSessionRescheduleArgs
} from "#convex/sessions/lib/schedulingArgs";
import {
	requirePackageSessionForReschedule,
	patchSessionBooking,
	scheduleDriveSetupWhenConfirmed,
	type SessionDriveSetupArgs
} from "#convex/sessions/lib/schedulingSave";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import {
	buildAdminSessionWriteArgs,
	buildClientSessionWriteArgs,
	deferPackageAdjustmentAfterReschedule,
	adminUpdatePatchForSession,
	requireAdminReservation,
	resolvedAdminSessionUpdate,
	validatedClientRescheduleSearchOverrides,
	requireClientRescheduleReservation
} from "#convex/sessions/lib/schedulingSaveSteps";

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

function writeSessionBookingPatchWithDriveSetup(args: {
	ctx: MutationCtx;
	bookingId: Doc<"bookings">["_id"];
	booking: Doc<"bookings">;
	patch: Partial<Doc<"bookings">>;
	searchOverrides?: BookingSearchPatchOverrides;
	driveSetup: SessionDriveSetupArgs;
}) {
	return safeTry(async function* () {
		const searchBlobPatch = yield* searchBlobPatchForBookingAsync(
			args.ctx,
			args.booking,
			args.searchOverrides
		);

		yield* patchSessionBooking(args.ctx, args.bookingId, { ...args.patch, ...searchBlobPatch });

		return ok(yield* scheduleDriveSetupWhenConfirmed(args.ctx, args.driveSetup));
	});
}

export function resolveAdminSessionUpdate(ctx: MutationCtx, args: SaveAdminSessionUpdateArgs) {
	const now = Date.now();

	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const updatePatch = yield* adminUpdatePatchForSession(args, session);
		const reservedSession = yield* requireAdminReservation(args, now, updatePatch);

		return ok(resolvedAdminSessionUpdate(args, reservedSession));
	});
}

export function writeAdminSessionUpdateWithDriveSetup(
	ctx: MutationCtx,
	args: SaveAdminSessionUpdateArgs,
	resolved: ResolvedAdminSessionUpdate
) {
	return writeSessionBookingPatchWithDriveSetup(buildAdminSessionWriteArgs(ctx, args, resolved));
}

export function validateClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	const now = Date.now();

	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const packageSession = yield* requirePackageSessionForReschedule(session, args.packageId);
		const reservedSession = yield* requireClientRescheduleReservation(args, now, packageSession);

		return ok(validatedClientRescheduleSearchOverrides(args, reservedSession));
	});
}

export function patchClientSessionReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs,
	validated: ValidatedClientSessionReschedule
) {
	return writeSessionBookingPatchWithDriveSetup(buildClientSessionWriteArgs(ctx, args, validated));
}

export function schedulePackageAdjustmentAfterReschedule(
	ctx: MutationCtx,
	args: SaveClientSessionRescheduleArgs
) {
	return deferPackageAdjustmentAfterReschedule(ctx, args);
}
