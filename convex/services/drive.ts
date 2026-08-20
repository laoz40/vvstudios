"use node";

import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { createDriveFolders, validateDriveSetup } from "#convex/lib/driveSetup";
import { fromConvexTuple } from "#convex/lib/result";

export type { SetupError } from "#convex/lib/driveSetup";

export function setupDriveService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() => fromConvexTuple(ctx.runQuery(internal.sessions.getDriveSetup, args)))
		.andThen(validateDriveSetup)
		.andThen((setupInfo) => createDriveFolders(ctx, args.bookingId, setupInfo));
}
