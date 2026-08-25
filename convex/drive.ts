"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import {
	retryEditorAssignmentEmailService,
	retryEditorAccessService,
	runEditorAccessSetupService,
	type DriveEditorPermissionsError
} from "#convex/services/driveEditorPermissions";

type RetryEditorAccessError =
	| DriveEditorPermissionsError
	| { reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED" };

export const retryEditorAccess = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, RetryEditorAccessError>> =>
		retryEditorAccessService(ctx, args).match(tupleOk, tupleErr)
});

export const retryEditorAssignmentEmail = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, RetryEditorAccessError>> =>
		retryEditorAssignmentEmailService(ctx, args).match(tupleOk, tupleErr)
});

export const setupEditorAccess = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, never>> =>
		runEditorAccessSetupService(ctx, args).match(tupleOk, tupleErr)
});
