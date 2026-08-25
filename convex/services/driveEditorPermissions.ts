"use node";

import { okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	sendEditorAssignmentEmailForReadyAccess,
	setupEditorAccess
} from "#convex/lib/driveEditorPermissions";

export type { DriveEditorPermissionsError } from "#convex/lib/driveEditorPermissions";

export function retryEditorAccessService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() => setupEditorAccess(ctx, args));
}

export function retryEditorAssignmentEmailService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		sendEditorAssignmentEmailForReadyAccess(ctx, args)
	);
}

export function runEditorAccessSetupService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return setupEditorAccess(ctx, args).orElse(() => okAsync(null));
}
