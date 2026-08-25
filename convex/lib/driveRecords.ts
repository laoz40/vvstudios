import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type {
	DriveChildFolderName,
	SavedDriveFolder,
	SavedDrivePermission
} from "#convex/lib/googleDrive";

const DRIVE_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type ClientDrivePermissionsStatus = "failed" | "ready";
type ClientDrivePermissionsDisplayStatus = "failed" | "incomplete" | "not_created" | "ready";
type AssetsEmailDisplayStatus = "failed" | "not_sent" | "pending" | "sent";

export function buildDriveStatus(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null,
	driveSetupFailed: boolean
) {
	if (driveSession === null) {
		const assetsUrl = driveClient?.assetsFolder?.url;
		if (driveSetupFailed) return { status: "failed" as const };
		if (assetsUrl === undefined) return { status: "not_created" as const };
		return { status: "incomplete" as const, folders: [{ name: "Assets", url: assetsUrl }] };
	}

	const folders = [
		{ name: "Assets", url: driveClient?.assetsFolder?.url },
		{ name: "Session", url: driveSession.sessionFolder?.url },
		{ name: "Raw Media", url: driveSession.rawMediaFolder?.url },
		{ name: "Deliverables", url: driveSession.deliverablesFolder?.url }
	] satisfies Array<{ name: "Assets" | "Session" | DriveChildFolderName; url: string | undefined }>;

	const isReady = folders.every((folder) => folder.url !== undefined);
	return { status: isReady ? ("ready" as const) : ("incomplete" as const), folders };
}

export function buildClientDrivePermissionsStatus(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	return {
		assetsEmailStatus: buildAssetsEmailStatus(driveClient, driveSession),
		status: buildClientDrivePermissionsDisplayStatus(driveClient, driveSession)
	};
}

function buildClientDrivePermissionsDisplayStatus(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null
): ClientDrivePermissionsDisplayStatus {
	if (driveClient === null || driveSession === null) {
		return "not_created";
	}

	const foldersAreReady = areClientDriveFoldersReady(driveClient, driveSession);
	const permissionsAreReady = areClientDrivePermissionsReady(driveClient);
	switch (driveSession.clientDrivePermissionsStatus) {
		case "failed":
			return "failed";
		case "ready":
			return foldersAreReady && permissionsAreReady ? "ready" : "incomplete";
		case undefined:
			return foldersAreReady ? "incomplete" : "not_created";
		default: {
			const _exhaustive: never = driveSession.clientDrivePermissionsStatus;
			return _exhaustive;
		}
	}
}

function areClientDriveFoldersReady(
	driveClient: Doc<"driveClients">,
	driveSession: Doc<"driveSessions">
) {
	return (
		driveClient.assetsFolder !== undefined &&
		driveSession.sessionFolder !== undefined &&
		driveSession.rawMediaFolder !== undefined &&
		driveSession.deliverablesFolder !== undefined
	);
}

function areClientDrivePermissionsReady(driveClient: Doc<"driveClients">) {
	return (
		driveClient.clientFolderPermission !== undefined &&
		driveClient.assetsClientPermission !== undefined
	);
}

function buildAssetsEmailStatus(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions"> | null
): AssetsEmailDisplayStatus {
	if (driveSession === null) return "not_sent";
	if (
		driveSession.assetsEmailStatus === "sent" &&
		driveSession.assetsEmailFolderId !== driveClient?.assetsFolder?.id
	) {
		return "not_sent";
	}

	switch (driveSession.assetsEmailStatus) {
		case "failed":
		case "sent":
			return driveSession.assetsEmailStatus;
		case undefined:
			return driveSession.assetsEmailClaimedAt === undefined ? "not_sent" : "pending";
		default: {
			const _exhaustive: never = driveSession.assetsEmailStatus;
			return _exhaustive;
		}
	}
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return ok(null);
		const normalizedEmail = booking.email.trim().toLowerCase();
		return okOrThrow(
			Promise.all([
				ctx.db
					.query("driveClients")
					.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
					.unique(),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique()
			])
		).map(([driveClient, driveSession]) => ({ booking, driveClient, driveSession }));
	});
}

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).map((setupInfo) => {
		const booking = setupInfo?.booking;
		const driveClient = setupInfo?.driveClient ?? null;
		const driveSession = setupInfo?.driveSession ?? null;
		return {
			...buildDriveStatus(driveClient, driveSession, booking?.driveSetupFailureCode !== undefined),
			clientDrivePermissions: buildClientDrivePermissionsStatus(driveClient, driveSession),
			editorDrivePermissions: buildEditorDrivePermissionsStatus(booking, driveSession)
		};
	});
}

export async function getEditorSessionDriveFolders(ctx: QueryCtx, booking: Doc<"bookings">) {
	const editorTokenIdentifier = booking.assignedEditorTokenIdentifier;
	if (editorTokenIdentifier === undefined) return null;
	const driveSession = await ctx.db
		.query("driveSessions")
		.withIndex("by_bookingId", (query) => query.eq("bookingId", booking._id))
		.unique();
	if (
		driveSession === null ||
		driveSession.editorDrivePermissionsStatus !== "ready" ||
		driveSession.editorDrivePermissionsTokenIdentifier !== editorTokenIdentifier
	) {
		return null;
	}
	const driveClient = await ctx.db.get(driveSession.driveClientId);
	if (
		driveClient?.assetsFolder === undefined ||
		driveSession.sessionFolder === undefined ||
		driveSession.rawMediaFolder === undefined ||
		driveSession.deliverablesFolder === undefined
	) {
		return null;
	}
	return {
		assets: driveClient.assetsFolder,
		deliverables: driveSession.deliverablesFolder,
		rawMedia: driveSession.rawMediaFolder,
		session: driveSession.sessionFolder
	};
}

function buildEditorDrivePermissionsStatus(
	booking: Doc<"bookings"> | undefined,
	driveSession: Doc<"driveSessions"> | null
) {
	const editorTokenIdentifier = booking?.assignedEditorTokenIdentifier;
	if (editorTokenIdentifier === undefined) {
		return { status: "not_assigned" as const, assignmentEmailStatus: "not_sent" as const };
	}

	if (
		driveSession === null ||
		driveSession.editorDrivePermissionsTokenIdentifier !== editorTokenIdentifier
	) {
		return { status: "pending" as const, assignmentEmailStatus: "not_sent" as const };
	}

	const status: "failed" | "pending" | "ready" =
		driveSession.editorDrivePermissionsStatus ?? "pending";
	let assignmentEmailStatus: "failed" | "not_sent" | "pending" | "sent" = "not_sent";
	if (driveSession.assignmentEmailTokenIdentifier === editorTokenIdentifier) {
		assignmentEmailStatus =
			driveSession.assignmentEmailStatus ??
			(driveSession.assignmentEmailClaimedAt === undefined ? "not_sent" : "pending");
	}

	return { status, assignmentEmailStatus };
}

export type EditorDriveSetupRecord = {
	booking: Doc<"bookings">;
	driveClient: Doc<"driveClients">;
	driveSession: Doc<"driveSessions">;
	editor: Doc<"editorProfiles">;
};

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
			return ok({
				...setup,
				driveClient: setup.driveClient!,
				driveSession: setup.driveSession!,
				editor
			});
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

export function saveDriveClientFolder(
	ctx: MutationCtx,
	clientFolder: { normalizedEmail: string; displayName: string; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) =>
				query.eq("normalizedEmail", clientFolder.normalizedEmail)
			)
			.unique()
	).andThen((existingClient) => {
		if (existingClient !== null) {
			return ok({
				driveClientId: existingClient._id,
				folderId: existingClient.folderId,
				assetsFolder: existingClient.assetsFolder
			});
		}
		return okOrThrow(
			ctx.db
				.insert("driveClients", {
					normalizedEmail: clientFolder.normalizedEmail,
					displayName: clientFolder.displayName,
					folderId: clientFolder.folder.id,
					folderUrl: clientFolder.folder.webViewLink,
					createdAt: Date.now()
				})
				.then((driveClientId) => ({
					driveClientId,
					folderId: clientFolder.folder.id,
					assetsFolder: undefined
				}))
		);
	});
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: { driveClientId: Id<"driveClients">; folder: SavedDriveFolder }
): ResultAsync<{ id: string; url: string }, { reason: "DRIVE_RECORD_NOT_FOUND" }> {
	return okOrThrow(ctx.db.get(args.driveClientId)).andThen((driveClient) => {
		if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		if (driveClient.assetsFolder !== undefined) return ok(driveClient.assetsFolder);
		const assetsFolder = { id: args.folder.id, url: args.folder.webViewLink };
		return okOrThrow(ctx.db.patch(driveClient._id, { assetsFolder }).then(() => assetsFolder));
	});
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	sessionFolder: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: SavedDriveFolder;
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", sessionFolder.bookingId))
			.unique()
	).andThen((existingSession) => {
		// A repeated save must keep using the folder that won the first database write.
		if (existingSession?.sessionFolder !== undefined) return ok(existingSession.sessionFolder.id);
		// A previous attempt may have created the record before it saved the session folder.
		if (existingSession !== null) {
			return okOrThrow(
				ctx.db
					.patch(existingSession._id, {
						sessionFolder: { id: sessionFolder.folder.id, url: sessionFolder.folder.webViewLink },
						updatedAt: Date.now()
					})
					.then(() => sessionFolder.folder.id)
			);
		}
		return okOrThrow(
			ctx.db
				.insert("driveSessions", {
					bookingId: sessionFolder.bookingId,
					driveClientId: sessionFolder.driveClientId,
					sessionFolder: { id: sessionFolder.folder.id, url: sessionFolder.folder.webViewLink },
					createdAt: Date.now(),
					updatedAt: Date.now()
				})
				.then(() => sessionFolder.folder.id)
		);
	});
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode?: string }
) {
	return okOrThrow(
		ctx.db
			.patch(args.bookingId, {
				driveSetupFailedAt: args.failureCode === undefined ? undefined : Date.now(),
				driveSetupFailureCode: args.failureCode
			})
			.then(() => null)
	);
}

export function saveDriveChildFolder(
	ctx: MutationCtx,
	childFolder: { bookingId: Id<"bookings">; name: DriveChildFolderName; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", childFolder.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		let folderFields;
		switch (childFolder.name) {
			case "Raw Media":
				folderFields = {
					rawMediaFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
				break;
			case "Deliverables":
				folderFields = {
					deliverablesFolder: { id: childFolder.folder.id, url: childFolder.folder.webViewLink }
				};
				break;
			default: {
				const exhaustiveName: never = childFolder.name;
				return exhaustiveName;
			}
		}
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, { ...folderFields, updatedAt: Date.now() })
				.then(() => driveSession._id)
		);
	});
}

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: SavedDrivePermission;
	}
) {
	return okOrThrow(ctx.db.get(args.bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		const normalizedEmail = booking.email.trim().toLowerCase();
		return okOrThrow(
			ctx.db
				.query("driveClients")
				.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
				.unique()
		).andThen((driveClient) => {
			if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
			switch (args.name) {
				case "Client folder":
					return okOrThrow(
						ctx.db
							.patch(driveClient._id, { clientFolderPermission: args.permission })
							.then(() => null)
					);
				case "Assets":
					return okOrThrow(
						ctx.db
							.patch(driveClient._id, { assetsClientPermission: args.permission })
							.then(() => null)
					);
				default: {
					const _exhaustive: never = args.name;
					return _exhaustive;
				}
			}
		});
	});
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: ClientDrivePermissionsStatus }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, {
					clientDrivePermissionsStatus: args.status,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}

function canClaimClientAssetsEmail(
	attempt: "automatic" | "retry",
	status: Doc<"driveSessions">["assetsEmailStatus"],
	isEmailCurrent: boolean
) {
	switch (attempt) {
		case "automatic":
			return status === undefined;
		case "retry":
			return status === undefined || status === "failed" || !isEmailCurrent;
		default: {
			const _exhaustive: never = attempt;
			return _exhaustive;
		}
	}
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return okOrThrow(ctx.db.get(args.bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
		const normalizedEmail = booking.email.trim().toLowerCase();
		return okOrThrow(
			Promise.all([
				ctx.db
					.query("driveClients")
					.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
					.unique(),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
					.unique()
			])
		).andThen(([driveClient, driveSession]) => {
			const assetsFolder = driveClient?.assetsFolder;
			const isEmailCurrent =
				driveSession?.assetsEmailStatus === "sent" &&
				driveSession.assetsEmailFolderId === assetsFolder?.id;
			if (
				driveSession === null ||
				driveSession.clientDrivePermissionsStatus !== "ready" ||
				assetsFolder === undefined ||
				isEmailCurrent ||
				(driveSession.assetsEmailClaimedAt !== undefined &&
					args.now - driveSession.assetsEmailClaimedAt < DRIVE_EMAIL_CLAIM_TIMEOUT_MS) ||
				!canClaimClientAssetsEmail(args.attempt, driveSession.assetsEmailStatus, isEmailCurrent)
			) {
				return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
			}

			return okOrThrow(
				ctx.db
					.patch(driveSession._id, { assetsEmailClaimedAt: args.now, updatedAt: Date.now() })
					.then(() => ({
						assetsUrl: assetsFolder.url,
						assetsFolderId: assetsFolder.id,
						bookingId: booking._id,
						claimedAt: args.now,
						email: booking.email,
						name: booking.name
					}))
			);
		});
	});
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: {
		assetsFolderId: string;
		bookingId: Id<"bookings">;
		claimedAt: number;
		status: "sent" | "failed";
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", args.bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null || driveSession.assetsEmailClaimedAt !== args.claimedAt) {
			return ok(null);
		}
		return okOrThrow(
			ctx.db
				.patch(driveSession._id, {
					assetsEmailClaimedAt: undefined,
					assetsEmailFolderId:
						args.status === "sent" ? args.assetsFolderId : driveSession.assetsEmailFolderId,
					assetsEmailStatus: args.status,
					updatedAt: Date.now()
				})
				.then(() => null)
		);
	});
}
