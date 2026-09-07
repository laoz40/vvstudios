import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS, getDriveSetup } from "#convex/lib/driveLookup";
import type { SavedDrivePermission } from "#convex/lib/googleDrive";
import { okOrThrow } from "#convex/lib/result";

export type EditorDriveSetupRecord = {
	booking: Doc<"bookings">;
	driveClient: Doc<"driveClients">;
	driveSession: Doc<"driveSessions">;
	editor: Doc<"editorProfiles">;
};

export type EditorDriveAccessToRemove = {
	assetsFolderId: string | null;
	assetsPermission: SavedDrivePermission | null;
	deliverablesFolderId: string | null;
	deliverablesPermission: SavedDrivePermission | null;
	driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
	driveSessionId: Id<"driveSessions">;
	sessionFolderId: string | null;
	sessionPermission: SavedDrivePermission | null;
};

function getAssetsAccessToRemove(args: {
	assetsPermissionRecord: Doc<"driveClientEditorPermissions"> | null;
	driveClient: Doc<"driveClients"> | null;
	hasOtherClientAssignment: boolean;
}) {
	if (args.hasOtherClientAssignment) {
		return { folderId: null, permission: null, recordId: null };
	}
	return {
		folderId: args.driveClient?.assetsFolder?.id ?? null,
		permission: args.assetsPermissionRecord?.assetsPermission ?? null,
		recordId: args.assetsPermissionRecord?._id ?? null
	};
}

function getSessionAccessToRemove(driveSession: Doc<"driveSessions">) {
	return {
		deliverablesFolderId: driveSession.deliverablesFolder?.id ?? null,
		deliverablesPermission: driveSession.editorDeliverablesPermission ?? null,
		driveSessionId: driveSession._id,
		sessionFolderId: driveSession.sessionFolder?.id ?? null,
		sessionPermission: driveSession.editorSessionPermission ?? null
	};
}

function buildEditorDriveAccessToRemove(args: {
	assetsPermissionRecord: Doc<"driveClientEditorPermissions"> | null;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions">;
	hasOtherClientAssignment: boolean;
}): EditorDriveAccessToRemove {
	const assetsAccess = getAssetsAccessToRemove(args);

	return {
		assetsFolderId: assetsAccess.folderId,
		assetsPermission: assetsAccess.permission,
		driveClientEditorPermissionId: assetsAccess.recordId,
		...getSessionAccessToRemove(args.driveSession)
	};
}

function hasOtherClientAssignment(assignedBookings: Doc<"bookings">[], bookingId: Id<"bookings">) {
	return assignedBookings.some((booking) => booking._id !== bookingId);
}

async function loadEditorClientDriveData(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	return await Promise.all([
		ctx.db.get(driveSession.driveClientId),
		ctx.db
			.query("driveClientEditorPermissions")
			.withIndex("by_driveClientId_and_editorTokenIdentifier", (query) =>
				query
					.eq("driveClientId", driveSession.driveClientId)
					.eq("editorTokenIdentifier", editorTokenIdentifier)
			)
			.unique(),
		ctx.db
			.query("bookings")
			.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
				query
					.eq("assignedEditorTokenIdentifier", editorTokenIdentifier)
					.eq("driveClientId", driveSession.driveClientId)
			)
			.collect()
	]);
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (
			driveSession === null ||
			driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
		) {
			return ok(null);
		}

		return okOrThrow(loadEditorClientDriveData(ctx, driveSession, args.editorTokenIdentifier)).map(
			([driveClient, assetsPermissionRecord, assignedBookings]) => {
				return buildEditorDriveAccessToRemove({
					assetsPermissionRecord,
					driveClient,
					driveSession,
					hasOtherClientAssignment: hasOtherClientAssignment(assignedBookings, args.bookingId)
				});
			}
		);
	});
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return okOrThrow(
		(async () => {
			const driveSession = await ctx.db
				.query("driveSessions")
				.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
				.unique();
			if (driveSession === null) return null;
			await ctx.db.patch(driveSession._id, {
				failedRemovalEditorTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			});
			return null;
		})()
	);
}

export type FailedEditorRemoval = {
	driveSessionId: Id<"driveSessions">;
	editorTokenIdentifier: string;
	editorEmail: string;
	sessionFolderId: string | null;
	deliverablesFolderId: string | null;
	assetsFolderId: string | null;
	driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
};

// The retry re-finds the failed editor's permissions by email and role because the saved
// permission fields now belong to the replacement editor.
export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	).andThen((driveSession) => {
		const editorTokenIdentifier = driveSession?.failedRemovalEditorTokenIdentifier;
		if (driveSession === null || editorTokenIdentifier === undefined) return ok(null);
		return okOrThrow(
			Promise.all([
				loadEditorClientDriveData(ctx, driveSession, editorTokenIdentifier),
				ctx.db
					.query("editorProfiles")
					.withIndex("by_tokenIdentifier", (query) =>
						query.eq("tokenIdentifier", editorTokenIdentifier)
					)
					.unique()
			])
		).andThen(([clientData, editor]) => {
			if (editor === null) return ok(null);
			const [driveClient, assetsPermissionRecord, assignedBookings] = clientData;
			const assetsAccess = getAssetsAccessToRemove({
				assetsPermissionRecord,
				driveClient,
				hasOtherClientAssignment: hasOtherClientAssignment(assignedBookings, bookingId)
			});
			return ok<FailedEditorRemoval | null>({
				driveSessionId: driveSession._id,
				editorTokenIdentifier,
				editorEmail: editor.email,
				sessionFolderId: driveSession.sessionFolder?.id ?? null,
				deliverablesFolderId: driveSession.deliverablesFolder?.id ?? null,
				assetsFolderId: assetsAccess.folderId,
				driveClientEditorPermissionId: assetsAccess.recordId
			});
		});
	});
}

export function clearPreviousEditorDriveAccess(
	ctx: MutationCtx,
	args: {
		driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
	}
) {
	return okOrThrow(
		(async () => {
			const driveSession = await ctx.db.get(args.driveSessionId);
			if (driveSession === null) return null;
			if (driveSession.editorDrivePermissionsTokenIdentifier === args.editorTokenIdentifier) {
				await ctx.db.patch(args.driveSessionId, {
					assignmentEmailClaimedAt: undefined,
					assignmentEmailStatus: undefined,
					assignmentEmailTokenIdentifier: undefined,
					editorDeliverablesPermission: undefined,
					editorDrivePermissionsStatus: undefined,
					editorDrivePermissionsTokenIdentifier: undefined,
					editorSessionPermission: undefined,
					failedRemovalEditorTokenIdentifier: undefined,
					updatedAt: Date.now()
				});
			} else {
				// A replacement editor's setup may already own the session fields; still clear the marker.
				await ctx.db.patch(args.driveSessionId, { failedRemovalEditorTokenIdentifier: undefined });
			}
			if (args.driveClientEditorPermissionId !== null) {
				await ctx.db.delete(args.driveClientEditorPermissionId);
			}
			return null;
		})()
	);
}

export type EditorDriveSetupRecordError = {
	reason:
		| "BOOKING_NOT_FOUND"
		| "DRIVE_FOLDERS_NOT_READY"
		| "EDITOR_NOT_ACTIVE"
		| "EDITOR_NOT_ASSIGNED";
};

export function getEditorDriveSetup(
	ctx: QueryCtx,
	bookingId: Id<"bookings">
): ResultAsync<EditorDriveSetupRecord, EditorDriveSetupRecordError> {
	return getDriveSetup(ctx, bookingId).andThen((setup) => {
		if (setup === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
		const editorTokenIdentifier = setup.booking.assignedEditorTokenIdentifier;
		if (editorTokenIdentifier === undefined) {
			return errAsync({ reason: "EDITOR_NOT_ASSIGNED" as const });
		}
		if (setup.driveClient === null || setup.driveSession === null) {
			return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
		}
		const { driveClient, driveSession } = setup;

		return okOrThrow(
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorTokenIdentifier)
				)
				.unique()
		).andThen((editor) => {
			if (editor === null || !editor.isActive) {
				return err({ reason: "EDITOR_NOT_ACTIVE" as const });
			}
			return ok({ ...setup, driveClient, driveSession, editor });
		});
	});
}

export function saveEditorDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: SavedDrivePermission;
	}
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup === null ||
			setup.driveClient === null ||
			setup.driveSession === null ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		switch (args.name) {
			case "Assets":
				// Assets access is shared across every session for this client and editor.
				return saveEditorAssetsPermission(ctx, {
					driveClientId: setup.driveClient._id,
					editorTokenIdentifier: args.editorTokenIdentifier,
					permission: args.permission
				});
			case "Session":
				// Session-specific permissions stay on the session's Drive record.
				return saveEditorSessionPermission(ctx, {
					driveSessionId: setup.driveSession._id,
					editorTokenIdentifier: args.editorTokenIdentifier,
					field: "editorSessionPermission",
					permission: args.permission
				});
			case "Deliverables":
				return saveEditorSessionPermission(ctx, {
					driveSessionId: setup.driveSession._id,
					editorTokenIdentifier: args.editorTokenIdentifier,
					field: "editorDeliverablesPermission",
					permission: args.permission
				});
			default: {
				const _exhaustive: never = args.name;
				return _exhaustive;
			}
		}
	});
}

function saveEditorAssetsPermission(
	ctx: MutationCtx,
	args: {
		driveClientId: Id<"driveClients">;
		editorTokenIdentifier: string;
		permission: SavedDrivePermission;
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveClientEditorPermissions")
			.withIndex("by_driveClientId_and_editorTokenIdentifier", (query) =>
				query
					.eq("driveClientId", args.driveClientId)
					.eq("editorTokenIdentifier", args.editorTokenIdentifier)
			)
			.unique()
	).andThen((existing) => {
		if (existing !== null) return ok(null);
		const now = Date.now();
		return okOrThrow(
			ctx.db
				.insert("driveClientEditorPermissions", {
					driveClientId: args.driveClientId,
					editorTokenIdentifier: args.editorTokenIdentifier,
					assetsPermission: args.permission,
					createdAt: now,
					updatedAt: now
				})
				.then(() => null)
		);
	});
}

function saveEditorSessionPermission(
	ctx: MutationCtx,
	args: {
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
		field: "editorDeliverablesPermission" | "editorSessionPermission";
		permission: SavedDrivePermission;
	}
) {
	return okOrThrow(
		ctx.db
			.patch(args.driveSessionId, {
				[args.field]: args.permission,
				editorDrivePermissionsTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}
		return okOrThrow(
			ctx.db
				.patch(setup.driveSession._id, {
					editorDrivePermissionsStatus: args.status,
					editorDrivePermissionsTokenIdentifier: args.editorTokenIdentifier,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}

type ClaimEditorAssignmentEmailArgs = {
	bookingId: Id<"bookings">;
	editorTokenIdentifier: string;
	now: number;
};

function canClaimEditorAssignmentEmail(
	driveSession: Doc<"driveSessions">,
	args: ClaimEditorAssignmentEmailArgs
) {
	const emailMatchesEditor =
		driveSession.assignmentEmailTokenIdentifier === args.editorTokenIdentifier;
	if (!emailMatchesEditor) return true;
	const claimedRecently =
		driveSession.assignmentEmailClaimedAt !== undefined &&
		args.now - driveSession.assignmentEmailClaimedAt < DRIVE_EMAIL_CLAIM_TIMEOUT_MS;
	if (claimedRecently) return false;
	switch (driveSession.assignmentEmailStatus) {
		case "failed":
		case undefined:
			return true;
		case "sent":
			return false;
		default: {
			const _exhaustive: never = driveSession.assignmentEmailStatus;
			return _exhaustive;
		}
	}
}

export function claimEditorAssignmentEmail(ctx: MutationCtx, args: ClaimEditorAssignmentEmailArgs) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup) => {
		// The email belongs to the current editor and can only follow completed Drive access.
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier ||
			setup.driveSession.editorDrivePermissionsStatus !== "ready" ||
			setup.driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
		}

		const driveSession = setup.driveSession;
		// Reject duplicate, recent, or already completed attempts.
		if (!canClaimEditorAssignmentEmail(driveSession, args)) {
			return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
		}

		// Load the current editor so the claim contains the final email details.
		return okOrThrow(
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", args.editorTokenIdentifier)
				)
				.unique()
		).andThen((editor) => {
			if (editor === null || !editor.isActive) {
				return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
			}
			// Save the claim before sending so another action cannot claim it concurrently.
			return okOrThrow(
				ctx.db
					.patch(driveSession._id, {
						assignmentEmailClaimedAt: args.now,
						assignmentEmailStatus: undefined,
						assignmentEmailTokenIdentifier: args.editorTokenIdentifier,
						updatedAt: Date.now()
					})
					.then(() => ({
						bookingId: setup.booking._id,
						claimedAt: args.now,
						editorEmail: editor.email,
						editorName: editor.displayName,
						editorTokenIdentifier: args.editorTokenIdentifier,
						sessionName: setup.booking.accountName.trim() || setup.booking.name,
						sessionStartAt: setup.booking.sessionStartAt
					}))
			);
		});
	});
}

export function saveEditorAssignmentEmailResult(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		claimedAt: number;
		editorTokenIdentifier: string;
		status: "failed" | "sent";
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (
			driveSession === null ||
			driveSession.assignmentEmailClaimedAt !== args.claimedAt ||
			driveSession.assignmentEmailTokenIdentifier !== args.editorTokenIdentifier
		) {
			return ok(null);
		}
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, {
					assignmentEmailClaimedAt: undefined,
					assignmentEmailStatus: args.status,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}
