"use node";

import { okAsync } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import {
	retryFailedPreviousEditorRemoval,
	runEditorAccessSetup,
	runEditorAssignmentEmailRetry,
	runEditorDriveAccessUpdate,
	type DriveEditorPermissionsError
} from "#convex/services/drive/driveEditorPermissions";

type RetryEditorAccessError =
	| DriveEditorPermissionsError
	| { reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED" };

export const retryEditorAccess = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, RetryEditorAccessError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => runEditorAccessSetup(ctx, args))
			.match(tupleOk, tupleErr)
});

export const retryEditorAssignmentEmail = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, RetryEditorAccessError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => runEditorAssignmentEmailRetry(ctx, args))
			.match(tupleOk, tupleErr)
});

export const setupEditorAccess = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, never>> =>
		runEditorAccessSetup(ctx, args)
			.orElse(() => okAsync(null))
			.match(tupleOk, tupleErr)
});

export const updateEditorDriveAccess = internalAction({
	args: { bookingId: v.id("bookings"), previousEditorTokenIdentifier: v.string() },
	handler: (ctx, args): Promise<Result<null, DriveEditorPermissionsError>> =>
		runEditorDriveAccessUpdate(ctx, args).match(tupleOk, tupleErr)
});

export const retryPreviousEditorRemoval = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, RetryEditorAccessError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => retryFailedPreviousEditorRemoval(ctx, args))
			.match(tupleOk, tupleErr)
});
