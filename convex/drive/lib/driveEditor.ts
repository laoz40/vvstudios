import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { DRIVE_EMAIL_CLAIM_TIMEOUT_MS, type DriveSetupInfo } from "#convex/drive/lib/driveLookup";
import type { SavedDrivePermission } from "#convex/drive/lib/googleDrive";
import { okOrThrow } from "#convex/shared/lib/result";

export type EditorDriveSetupRecord = {
	booking: Doc<"bookings">;
	driveClient: Doc<"driveClients">;
	driveSession: Doc<"driveSessions">;
	editor: Doc<"editorProfiles">;
};

export function getEditorPermissionFolder(
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session"
) {
	if (name === "Assets") {
		return setup.driveClient.assetsFolder;
	}

	if (name === "Deliverables") {
		return setup.driveSession.deliverablesFolder;
	}

	return setup.driveSession.sessionFolder;
}

export type EditorDriveAccessToRemove = {
	assetsFolderId: string | null;
	assetsPermission: SavedDrivePermission | null;
	editorRetired: boolean;
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
	editorIsActive: boolean;
	hasOtherClientAssignment: boolean;
}): EditorDriveAccessToRemove {
	const assetsAccess = getAssetsAccessToRemove(args);

	return {
		assetsFolderId: assetsAccess.folderId,
		assetsPermission: assetsAccess.permission,
		editorRetired: !args.editorIsActive,
		driveClientEditorPermissionId: assetsAccess.recordId,
		...getSessionAccessToRemove(args.driveSession)
	};
}

function hasOtherClientAssignment(
	assignedBookings: Doc<"bookings">[],
	bookingId: Id<"bookings">,
	editorIsActive: boolean
) {
	return editorIsActive && assignedBookings.some((booking) => booking._id !== bookingId);
}

export function loadEditorProfileByToken(ctx: QueryCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", editorTokenIdentifier)
			)
			.unique()
	);
}

export function loadEditorClientDriveData(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions">,
	editorTokenIdentifier: string
) {
	return okOrThrow(
		Promise.all([
			ctx.db.get("driveClients", driveSession.driveClientId),
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
				.collect(),
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorTokenIdentifier)
				)
				.unique()
		])
	);
}

export function editorDriveAccessToRemoveForSession(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	if (
		driveSession === null ||
		driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
	) {
		return ok(null);
	}

	return loadEditorClientDriveData(ctx, driveSession, args.editorTokenIdentifier).map(
		([driveClient, assetsPermissionRecord, assignedBookings, editor]) => {
			return buildEditorDriveAccessToRemove({
				assetsPermissionRecord,
				driveClient,
				driveSession,
				editorIsActive: editor?.isActive ?? false,
				hasOtherClientAssignment: hasOtherClientAssignment(
					assignedBookings,
					args.bookingId,
					editor?.isActive ?? false
				)
			});
		}
	);
}

export function listEditorRetirementSessions(ctx: QueryCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		Promise.all([
			ctx.db
				.query("driveSessions")
				.withIndex("by_editorDrivePermissionsTokenIdentifier", (query) =>
					query.eq("editorDrivePermissionsTokenIdentifier", editorTokenIdentifier)
				)
				.collect(),
			ctx.db
				.query("driveSessions")
				.withIndex("by_failedRemovalEditorTokenIdentifier", (query) =>
					query.eq("failedRemovalEditorTokenIdentifier", editorTokenIdentifier)
				)
				.collect(),
			ctx.db
				.query("bookings")
				.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (query) =>
					query.eq("assignedEditorTokenIdentifier", editorTokenIdentifier)
				)
				.collect()
		])
	).map(([permissionSessions, failedRemovalSessions, assignedBookings]) => ({
		permissionSessions,
		failedRemovalSessions,
		assignedBookings
	}));
}

export function loadDriveSessionsForBookings(ctx: QueryCtx, bookingIds: Id<"bookings">[]) {
	return okOrThrow(
		Promise.all(
			bookingIds.map((bookingId) =>
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique()
			)
		)
	);
}

export function listEditorAssetPermissionsForRetirement(
	ctx: QueryCtx,
	editorTokenIdentifier: string
) {
	return okOrThrow(
		ctx.db
			.query("driveClientEditorPermissions")
			.withIndex("by_editorTokenIdentifier", (query) =>
				query.eq("editorTokenIdentifier", editorTokenIdentifier)
			)
			.collect()
	);
}

export function loadEditorAssetPermissionRetirementInfo(
	ctx: QueryCtx,
	permission: Doc<"driveClientEditorPermissions">
) {
	return okOrThrow(
		Promise.all([
			ctx.db.get("driveClients", permission.driveClientId),
			ctx.db
				.query("driveSessions")
				.withIndex("by_driveClientId", (query) =>
					query.eq("driveClientId", permission.driveClientId)
				)
				.first()
		])
	).map(([driveClient, driveSession]) => ({
		assetsFolderId: driveClient?.assetsFolder?.id ?? null,
		bookingId: driveSession?.bookingId ?? null,
		permission
	}));
}

export function markPreviousEditorRemovalFailedForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: { editorTokenIdentifier: string }
) {
	if (driveSession === null) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				failedRemovalEditorTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}

export type FailedEditorRemoval = {
	driveSessionId: Id<"driveSessions">;
	editorTokenIdentifier: string;
	editorRetired: boolean;
	editorEmail: string;
	sessionFolderId: string | null;
	deliverablesFolderId: string | null;
	assetsFolderId: string | null;
	driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
};

// The retry re-finds the failed editor's permissions by email and role because the saved
// permission fields now belong to the replacement editor.
export function failedEditorRemovalForSession(
	driveSession: Doc<"driveSessions"> | null,
	bookingId: Id<"bookings">,
	editor: Doc<"editorProfiles"> | null,
	clientData:
		| [
				Doc<"driveClients"> | null,
				Doc<"driveClientEditorPermissions"> | null,
				Doc<"bookings">[],
				Doc<"editorProfiles"> | null
		  ]
		| null
) {
	const editorTokenIdentifier = driveSession?.failedRemovalEditorTokenIdentifier;

	if (
		driveSession === null ||
		editorTokenIdentifier === undefined ||
		editor === null ||
		clientData === null
	) {
		return null;
	}

	const [driveClient, assetsPermissionRecord, assignedBookings] = clientData;

	const assetsAccess = getAssetsAccessToRemove({
		assetsPermissionRecord,
		driveClient,
		hasOtherClientAssignment: hasOtherClientAssignment(assignedBookings, bookingId, editor.isActive)
	});

	return {
		driveSessionId: driveSession._id,
		editorTokenIdentifier,
		editorRetired: !editor.isActive,
		editorEmail: editor.email,
		sessionFolderId: driveSession.sessionFolder?.id ?? null,
		deliverablesFolderId: driveSession.deliverablesFolder?.id ?? null,
		assetsFolderId: assetsAccess.folderId,
		driveClientEditorPermissionId: assetsAccess.recordId
	} satisfies FailedEditorRemoval;
}

export function clearPreviousEditorDriveAccessForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: {
		driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
		retired: boolean;
	}
) {
	if (driveSession === null) {
		return okAsync(null);
	}

	const patchDriveSession =
		driveSession.editorDrivePermissionsTokenIdentifier === args.editorTokenIdentifier
			? okOrThrow(
					ctx.db
						.patch("driveSessions", args.driveSessionId, {
							assignmentEmailClaimedAt: undefined,
							assignmentEmailStatus: undefined,
							assignmentEmailTokenIdentifier: undefined,
							editorDeliverablesPermission: undefined,
							editorDrivePermissionsStatus: args.retired ? "revoked" : undefined,
							editorDrivePermissionsTokenIdentifier: args.retired
								? args.editorTokenIdentifier
								: undefined,
							editorSessionPermission: undefined,
							failedRemovalEditorTokenIdentifier: undefined,
							updatedAt: Date.now()
						})
						.then(() => null)
				)
			: okOrThrow(
					ctx.db
						.patch("driveSessions", args.driveSessionId, {
							failedRemovalEditorTokenIdentifier: undefined
						})
						.then(() => null)
				);

	return patchDriveSession;
}

export function loadEditorAssetPermissionForClear(
	ctx: MutationCtx,
	permissionId: Id<"driveClientEditorPermissions"> | null
) {
	if (permissionId === null) return okAsync(null);

	return okOrThrow(ctx.db.get("driveClientEditorPermissions", permissionId));
}

export function deleteEditorAssetPermissionIfOwned(
	ctx: MutationCtx,
	permission: Doc<"driveClientEditorPermissions"> | null,
	args: { editorTokenIdentifier: string }
) {
	if (permission === null || permission.editorTokenIdentifier !== args.editorTokenIdentifier) {
		return okAsync(null);
	}

	return okOrThrow(ctx.db.delete("driveClientEditorPermissions", permission._id).then(() => null));
}

export function markEditorDriveAccessRevokedForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: { driveSessionId: Id<"driveSessions">; editorTokenIdentifier: string }
) {
	if (driveSession === null || driveSession.editorDrivePermissionsTokenIdentifier !== undefined) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.db
			.patch("driveSessions", args.driveSessionId, {
				assignmentEmailClaimedAt: undefined,
				assignmentEmailStatus: undefined,
				assignmentEmailTokenIdentifier: undefined,
				editorDrivePermissionsStatus: "revoked",
				editorDrivePermissionsTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}

export type EditorDriveSetupRecordError = {
	reason:
		| "BOOKING_NOT_FOUND"
		| "DRIVE_FOLDERS_NOT_READY"
		| "EDITOR_NOT_ACTIVE"
		| "EDITOR_NOT_ASSIGNED";
};

export function editorDriveSetupFromLoaded(
	setup: DriveSetupInfo | null,
	editor: Doc<"editorProfiles"> | null
): ResultAsync<EditorDriveSetupRecord, EditorDriveSetupRecordError> {
	if (setup === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
	const editorTokenIdentifier = setup.booking.assignedEditorTokenIdentifier;

	if (editorTokenIdentifier === undefined) {
		return errAsync({ reason: "EDITOR_NOT_ASSIGNED" as const });
	}

	if (setup.driveClient === null || setup.driveSession === null) {
		return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	if (editor === null || !editor.isActive) {
		return errAsync({ reason: "EDITOR_NOT_ACTIVE" as const });
	}

	const { driveClient, driveSession } = setup;

	return okAsync({ ...setup, driveClient, driveSession, editor });
}

export type EditorDrivePermissionSetup = {
	driveClient: Doc<"driveClients">;
	driveSession: Doc<"driveSessions">;
};

export function writeEditorDrivePermission(
	ctx: MutationCtx,
	setup: EditorDrivePermissionSetup,
	args: {
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: SavedDrivePermission;
	}
) {
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
		default:
			return exhaustiveCheck(args.name);
	}
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
			.patch("driveSessions", args.driveSessionId, {
				[args.field]: args.permission,
				editorDrivePermissionsTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}

export function writeEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions">,
	args: { editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				editorDrivePermissionsStatus: args.status,
				editorDrivePermissionsTokenIdentifier: args.editorTokenIdentifier,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
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
		default:
			return exhaustiveCheck(driveSession.assignmentEmailStatus);
	}
}

export type EditorAssignmentEmailClaim = {
	bookingId: Id<"bookings">;
	claimedAt: number;
	editorEmail: string;
	editorName: string;
	editorTokenIdentifier: string;
	sessionName: string;
	sessionStartAt: number | undefined;
};

export function claimEditorAssignmentEmailForEditor(
	ctx: MutationCtx,
	setup: DriveSetupInfo & { driveSession: Doc<"driveSessions"> },
	args: ClaimEditorAssignmentEmailArgs,
	editor: Doc<"editorProfiles"> | null
) {
	const driveSession = setup.driveSession;

	// Reject duplicate, recent, or already completed attempts.
	if (!canClaimEditorAssignmentEmail(driveSession, args)) {
		return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
	}

	if (editor === null || !editor.isActive) {
		return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
	}

	// Save the claim before sending so another action cannot claim it concurrently.
	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
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
}

export function saveEditorAssignmentEmailResultForSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null,
	args: { claimedAt: number; editorTokenIdentifier: string; status: "failed" | "sent" }
) {
	if (
		driveSession === null ||
		driveSession.assignmentEmailClaimedAt !== args.claimedAt ||
		driveSession.assignmentEmailTokenIdentifier !== args.editorTokenIdentifier
	) {
		return ok(null);
	}

	return okOrThrow(
		ctx.db
			.patch("driveSessions", driveSession._id, {
				assignmentEmailClaimedAt: undefined,
				assignmentEmailStatus: args.status,
				updatedAt: Date.now()
			})
			.then(() => null)
	);
}
