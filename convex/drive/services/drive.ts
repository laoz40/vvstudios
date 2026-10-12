"use node";

import { err, ok, okAsync, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	getDriveSetupRow,
	saveReportableDriveSetupFailure,
	saveDriveSetupResultRow
} from "#convex/drive/lib/driveFolderMutations";
import {
	validateDriveSetup,
	validateSavedDriveSetupFolders,
	type SetupError as LibSetupError
} from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/drive/services/driveClientPermissions";
import { setupEditorAccess } from "#convex/drive/services/editorDrivePermissions";

export type SetupError = LibSetupError;

type DriveSetupLoadArgs = { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string };

export function loadValidatedDriveSetup(ctx: ActionCtx, args: DriveSetupLoadArgs) {
	return safeTry(async function* () {
		const setupInfo = yield* getDriveSetupRow(ctx, args.bookingId);

		const validatedSetup = yield* validateDriveSetup(setupInfo, {
			sessionStartAt: args.sessionStartAt,
			duration: args.duration
		});

		return ok(validatedSetup);
	});
}

export function markDriveSetupSuccessful(ctx: ActionCtx, args: DriveSetupLoadArgs) {
	// Re-read saved folders and timing before marking setup complete.
	return safeTry(async function* () {
		const setupInfo = yield* loadValidatedDriveSetup(ctx, args);
		yield* validateSavedDriveSetupFolders(setupInfo);
		const saved = yield* saveDriveSetupResultRow(ctx, { bookingId: args.bookingId });

		return ok(saved);
	});
}

export function sendClientAssetsEmailAfterSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	// Access/email failures have their own statuses and must not fail folder setup.
	return requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
		bookingId,
		attempt: "automatic"
	}).orElse(() => okAsync(null));
}

export function setupEditorAccessAfterSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return setupEditorAccess(ctx, { bookingId }).orElse(() => okAsync(null));
}

export function recordDriveSetupFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	setupError: SetupError
) {
	return safeTry(async function* () {
		yield* saveReportableDriveSetupFailure(ctx, bookingId, setupError);

		return err(setupError);
	});
}
