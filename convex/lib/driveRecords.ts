import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import type {
	DriveChildFolderName,
	SavedDriveFolder,
	SavedDrivePermission
} from "#convex/lib/googleDrive";
import {
	formatDriveClientFolderName,
	formatDrivePackageFolderName,
	formatDrivePackageSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

const DRIVE_EMAIL_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type ClientDrivePermissionsStatus = "failed" | "ready";
type ClientDrivePermissionsDisplayStatus = "failed" | "incomplete" | "not_created" | "ready";
type AssetsEmailDisplayStatus = "failed" | "not_sent" | "pending" | "sent";
type DriveStatusFolderName = "Assets" | "Package" | "Session" | DriveChildFolderName;

// Package session folders live inside their package folder; ordinary sessions sit directly
// below the client folder, so the session label differs between the two kinds.
function getSavedPackageFolderName(multiBookingPackage: Doc<"multiBookingPackages"> | null) {
	if (multiBookingPackage === null) return undefined;
	return formatDrivePackageFolderName({
		packageSize: multiBookingPackage.packageSize,
		purchasedAt: multiBookingPackage.paidAt ?? multiBookingPackage.createdAt
	});
}

function getSavedSessionFolderName(
	booking: Doc<"bookings"> | null,
	driveSession: Doc<"driveSessions"> | null
) {
	if (booking === null) return undefined;
	if (driveSession?.packageSessionNumber === undefined) {
		return formatDriveSessionFolderName(booking.sessionStartAt);
	}
	return formatDrivePackageSessionFolderName(
		driveSession.packageSessionNumber,
		booking.sessionStartAt
	);
}

type DriveStatusFolder = { name: DriveStatusFolderName; url: string | undefined };
type SavedPackageFolder = NonNullable<Doc<"driveSessions">["packageFolder"]>;

function getSavedFolderRows(
	driveClient: Doc<"driveClients"> | null,
	driveSession: Doc<"driveSessions">,
	packageFolderName: string | undefined,
	sharedPackageFolder: SavedPackageFolder | undefined
): DriveStatusFolder[] {
	// Package sessions have a package folder row between the assets and session rows.
	const packageFolderRow: DriveStatusFolder[] =
		packageFolderName === undefined
			? []
			: [{ name: "Package", url: driveSession.packageFolder?.url ?? sharedPackageFolder?.url }];
	return [
		{ name: "Assets", url: driveClient?.assetsFolder?.url },
		...packageFolderRow,
		{ name: "Session", url: driveSession.sessionFolder?.url },
		{ name: "Raw Media", url: driveSession.rawMediaFolder?.url },
		{ name: "Deliverables", url: driveSession.deliverablesFolder?.url }
	];
}

type DriveStatusArgs = {
	driveClient: Doc<"driveClients"> | null;
	driveSetupFailed: boolean;
	sharedPackageFolder: SavedPackageFolder | undefined;
};

type DriveDisplayStatus = {
	status: "failed" | "not_created" | "incomplete" | "ready";
	packageFolderName: string | undefined;
	sessionFolderName: string | undefined;
	folders?: DriveStatusFolder[];
};

function getNoSessionDriveStatus(
	args: DriveStatusArgs,
	packageFolderName: string | undefined,
	sessionFolderName: string | undefined
): DriveDisplayStatus {
	const base = { packageFolderName, sessionFolderName };
	if (args.driveSetupFailed) return { status: "failed", ...base };
	const assetsUrl = args.driveClient?.assetsFolder?.url;
	const packageUrl = args.sharedPackageFolder?.url;
	// A sibling session may already own the package folder even though this session has none.
	if (assetsUrl === undefined && packageUrl === undefined)
		return { status: "not_created", ...base };
	const folders: DriveStatusFolder[] = [];
	if (assetsUrl !== undefined) folders.push({ name: "Assets", url: assetsUrl });
	if (packageFolderName !== undefined) folders.push({ name: "Package", url: packageUrl });
	return { status: "incomplete", ...base, folders };
}

export function buildDriveStatus(args: {
	booking: Doc<"bookings"> | null;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions"> | null;
	multiBookingPackage: Doc<"multiBookingPackages"> | null;
	driveSetupFailed: boolean;
	sharedPackageFolder: SavedPackageFolder | undefined;
}): DriveDisplayStatus {
	const packageFolderName = getSavedPackageFolderName(args.multiBookingPackage);
	const sessionFolderName = getSavedSessionFolderName(args.booking, args.driveSession);

	if (args.driveSession === null) {
		return getNoSessionDriveStatus(args, packageFolderName, sessionFolderName);
	}

	const folders = getSavedFolderRows(
		args.driveClient,
		args.driveSession,
		packageFolderName,
		args.sharedPackageFolder
	);
	const isReady = folders.every((folder) => folder.url !== undefined);
	return {
		status: isReady ? "ready" : "incomplete",
		packageFolderName,
		sessionFolderName,
		folders
	};
}

function getDriveIdentityStatus(
	booking: Doc<"bookings"> | null,
	driveClient: Doc<"driveClients"> | null
) {
	if (booking === null || driveClient === null) {
		return { bookingEmailChanged: false, workspaceNameChanged: false };
	}
	return {
		bookingEmailChanged: booking.email.trim().toLowerCase() !== driveClient.normalizedEmail,
		workspaceNameChanged:
			formatDriveClientFolderName({
				accountName: booking.accountName,
				contactName: booking.name
			}) !== driveClient.displayName
	};
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

function hasClientDriveWorkflowFailure(
	clientDrivePermissions: ReturnType<typeof buildClientDrivePermissionsStatus>
) {
	return (
		clientDrivePermissions.status === "failed" ||
		clientDrivePermissions.status === "incomplete" ||
		clientDrivePermissions.assetsEmailStatus === "failed"
	);
}

function hasEditorDriveWorkflowFailure(
	folderStatus: DriveDisplayStatus["status"],
	editorDrivePermissions: ReturnType<typeof buildEditorDrivePermissionsStatus>
) {
	if (editorDrivePermissions.status === "failed") return true;
	if (folderStatus === "ready" && editorDrivePermissions.status === "pending") return true;
	return (
		editorDrivePermissions.status === "ready" &&
		editorDrivePermissions.assignmentEmailStatus === "failed"
	);
}

export function hasDriveWorkflowFailure(args: {
	clientDrivePermissions: ReturnType<typeof buildClientDrivePermissionsStatus>;
	editorDrivePermissions: ReturnType<typeof buildEditorDrivePermissionsStatus>;
	folderStatus: DriveDisplayStatus["status"];
	folders: DriveDisplayStatus["folders"];
	previousEditorRemovalFailed: boolean;
}) {
	if (args.folderStatus === "failed") return true;
	// Incomplete only counts when this session's own folders were started, not a sibling
	// package folder that already exists for another session.
	if (
		args.folderStatus === "incomplete" &&
		args.folders?.some((folder) => folder.name === "Session")
	) {
		return true;
	}
	if (hasClientDriveWorkflowFailure(args.clientDrivePermissions)) return true;
	if (hasEditorDriveWorkflowFailure(args.folderStatus, args.editorDrivePermissions)) return true;
	return args.previousEditorRemovalFailed;
}

type DriveWorkflowFailureInputs = {
	booking: Doc<"bookings"> | null;
	driveClient: Doc<"driveClients"> | null;
	driveSession: Doc<"driveSessions"> | null;
	multiBookingPackage: Doc<"multiBookingPackages"> | null;
	sharedPackageFolder: SavedPackageFolder | undefined;
};

function computeHasDriveWorkflowFailure(args: DriveWorkflowFailureInputs) {
	const folderStatus = buildDriveStatus({
		booking: args.booking,
		driveClient: args.driveClient,
		driveSession: args.driveSession,
		multiBookingPackage: args.multiBookingPackage,
		driveSetupFailed: args.booking?.driveSetupFailureCode !== undefined,
		sharedPackageFolder: args.sharedPackageFolder
	});
	const clientDrivePermissions = buildClientDrivePermissionsStatus(
		args.driveClient,
		args.driveSession
	);
	const editorDrivePermissions = buildEditorDrivePermissionsStatus(args.booking, args.driveSession);
	return hasDriveWorkflowFailure({
		clientDrivePermissions,
		editorDrivePermissions,
		folderStatus: folderStatus.status,
		folders: folderStatus.folders,
		previousEditorRemovalFailed: args.driveSession?.failedRemovalEditorTokenIdentifier !== undefined
	});
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

async function resolveDriveClientForBooking(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions"> | null,
	driveClientFromBooking: Doc<"driveClients"> | null
): Promise<Doc<"driveClients"> | null> {
	if (driveSession?.driveClientId !== undefined) {
		const sessionClient = await ctx.db.get(driveSession.driveClientId);
		if (sessionClient !== null) return sessionClient;
	}
	return driveClientFromBooking;
}

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return ok(null);
		return okOrThrow(
			Promise.all([
				booking.driveClientId !== undefined
					? ctx.db.get(booking.driveClientId)
					: Promise.resolve(null),
				ctx.db
					.query("driveSessions")
					.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
					.unique(),
				booking.multiBookingPackageId !== undefined
					? ctx.db.get(booking.multiBookingPackageId)
					: Promise.resolve(null)
			])
		).andThen(([driveClientFromBooking, driveSession, multiBookingPackage]) =>
			okOrThrow(resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking)).andThen(
				(driveClient) => {
					if (
						driveSession?.packageFolder !== undefined ||
						booking.multiBookingPackageId === undefined
					) {
						return ok({
							booking,
							driveClient,
							driveSession,
							multiBookingPackage,
							sharedPackageFolder: undefined
						});
					}
					return okOrThrow(
						loadSharedPackageFolder(ctx, booking.multiBookingPackageId, booking._id)
					).map((sharedPackageFolder) => ({
						booking,
						driveClient,
						driveSession,
						multiBookingPackage,
						sharedPackageFolder
					}));
				}
			)
		);
	});
}

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).map((setupInfo) => {
		const booking = setupInfo?.booking ?? null;
		const driveClient = setupInfo?.driveClient ?? null;
		const driveSession = setupInfo?.driveSession ?? null;
		const multiBookingPackage = setupInfo?.multiBookingPackage ?? null;
		const folderStatus = buildDriveStatus({
			booking,
			driveClient,
			driveSession,
			multiBookingPackage,
			driveSetupFailed: booking?.driveSetupFailureCode !== undefined,
			sharedPackageFolder: setupInfo?.sharedPackageFolder
		});
		const clientDrivePermissions = buildClientDrivePermissionsStatus(driveClient, driveSession);
		const editorDrivePermissions = buildEditorDrivePermissionsStatus(booking, driveSession);
		const previousEditorRemovalFailed =
			driveSession?.failedRemovalEditorTokenIdentifier !== undefined;
		return {
			...folderStatus,
			...getDriveIdentityStatus(booking, driveClient),
			clientDrivePermissions,
			driveSetupFailureCode: booking?.driveSetupFailureCode,
			editorDrivePermissions,
			hasDriveWorkflowFailure: hasDriveWorkflowFailure({
				clientDrivePermissions,
				editorDrivePermissions,
				folderStatus: folderStatus.status,
				folders: folderStatus.folders,
				previousEditorRemovalFailed
			}),
			previousEditorRemovalFailed
		};
	});
}

// Admin session lists only need the failure flag, not the full Drive status payload.
export async function getDriveWorkflowFailureForBooking(ctx: QueryCtx, booking: Doc<"bookings">) {
	const [driveClientFromBooking, driveSession, multiBookingPackage] = await Promise.all([
		booking.driveClientId !== undefined ? ctx.db.get(booking.driveClientId) : null,
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", booking._id))
			.unique(),
		booking.multiBookingPackageId !== undefined ? ctx.db.get(booking.multiBookingPackageId) : null
	]);
	const driveClient = await resolveDriveClientForBooking(ctx, driveSession, driveClientFromBooking);
	const sharedPackageFolder =
		driveSession?.packageFolder === undefined && booking.multiBookingPackageId !== undefined
			? await loadSharedPackageFolder(ctx, booking.multiBookingPackageId, booking._id)
			: undefined;

	return computeHasDriveWorkflowFailure({
		booking,
		driveClient,
		driveSession,
		multiBookingPackage,
		sharedPackageFolder
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
	booking: Doc<"bookings"> | null,
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

// The record starts without a folder; Drive setup creates and saves the client folder later.
export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
): ResultAsync<Id<"driveClients">, never> {
	const normalizedEmail = client.email.trim().toLowerCase();
	return okOrThrow(
		ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
			.unique()
	).andThen((existingClient) => {
		if (existingClient !== null) return ok(existingClient._id);
		return okOrThrow(
			ctx.db.insert("driveClients", {
				normalizedEmail,
				displayName: client.displayName,
				createdAt: Date.now()
			})
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
			// The row was created at booking time, so it may have no folder yet.
			if (existingClient.folderId === undefined) {
				return okOrThrow(
					ctx.db
						.patch(existingClient._id, {
							folderId: clientFolder.folder.id,
							folderUrl: clientFolder.folder.webViewLink
						})
						.then(() => null)
				).map(() => ({
					driveClientId: existingClient._id,
					folderId: clientFolder.folder.id,
					assetsFolder: existingClient.assetsFolder
				}));
			}
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
		const assetsFolder = { id: args.folder.id, url: args.folder.webViewLink };
		if (driveClient.assetsFolder !== undefined && driveClient.assetsFolder.id === assetsFolder.id) {
			return ok(driveClient.assetsFolder);
		}
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

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	packageFolder: { bookingId: Id<"bookings">; folder: SavedDriveFolder }
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageFolder.bookingId))
			.unique()
	).andThen((driveSession) => {
		// A repeated save must keep the package folder that won the first database write.
		if (driveSession?.packageFolder !== undefined) return ok(driveSession.packageFolder.id);
		if (driveSession !== null) {
			return okOrThrow(
				ctx.db
					.patch(driveSession._id, {
						packageFolder: { id: packageFolder.folder.id, url: packageFolder.folder.webViewLink },
						updatedAt: Date.now()
					})
					.then(() => packageFolder.folder.id)
			);
		}
		return okOrThrow(ctx.db.get(packageFolder.bookingId)).andThen((booking) => {
			if (booking === null || booking.driveClientId === undefined) {
				return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
			}
			return okOrThrow(
				ctx.db
					.insert("driveSessions", {
						bookingId: packageFolder.bookingId,
						driveClientId: booking.driveClientId,
						packageFolder: { id: packageFolder.folder.id, url: packageFolder.folder.webViewLink },
						createdAt: Date.now(),
						updatedAt: Date.now()
					})
					.then(() => packageFolder.folder.id)
			);
		});
	});
}

type PackageSessionNumberError = {
	reason: "BOOKING_NOT_FOUND" | "BOOKING_NOT_PACKAGE" | "DRIVE_RECORD_NOT_FOUND";
};

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getPackageBooking(ctx, args.bookingId)
		.andThen((packageBooking) => resolvePackageSessionNumber(ctx, packageBooking))
		.andThen((allocation) => {
			// A retry re-enters with its number already saved; only fresh allocations write.
			if (allocation.kind === "already_saved") return okAsync(allocation.number);
			return savePackageSessionNumber(ctx, allocation);
		});
}

type PackageBooking = { booking: Doc<"bookings">; packageId: Id<"multiBookingPackages"> };

function getPackageBooking(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<PackageBooking, PackageSessionNumberError> {
	return okOrThrow(ctx.db.get(bookingId)).andThen((booking) => {
		if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
		if (booking.multiBookingPackageId === undefined) {
			return err({ reason: "BOOKING_NOT_PACKAGE" as const });
		}
		return ok({ booking, packageId: booking.multiBookingPackageId });
	});
}

type PackageSessionNumberAllocation =
	| { kind: "already_saved"; number: number }
	| {
			kind: "new";
			booking: Doc<"bookings">;
			existingSession: Doc<"driveSessions"> | null;
			number: number;
	  };

// On a retry the saved number wins; otherwise the number is the session's position in the
// package's date order, skipping numbers other sessions already have.
function resolvePackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<PackageSessionNumberAllocation, PackageSessionNumberError> {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking.booking._id))
			.unique()
	).andThen((existingSession) => {
		if (existingSession?.packageSessionNumber !== undefined) {
			return okAsync({
				kind: "already_saved" as const,
				number: existingSession.packageSessionNumber
			});
		}
		return loadNextPackageSessionNumber(ctx, packageBooking).map((number) => ({
			kind: "new" as const,
			booking: packageBooking.booking,
			existingSession,
			number
		}));
	});
}

function loadNextPackageSessionNumber(
	ctx: MutationCtx,
	packageBooking: PackageBooking
): ResultAsync<number, PackageSessionNumberError> {
	return okOrThrow(loadPackageSessionsSortedByDate(ctx, packageBooking.packageId)).andThen(
		(scheduledSessions) => {
			const sessionIndex = scheduledSessions.findIndex(
				(item) => item._id === packageBooking.booking._id
			);
			if (sessionIndex === -1) {
				return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
			}
			return okOrThrow(loadSavedPackageSessionNumbers(ctx, packageBooking.packageId)).map(
				(savedNumbers) => {
					// Start at the session's date-order position and step past numbers already in use.
					let number = sessionIndex + 1;
					while (savedNumbers.has(number)) number += 1;
					return number;
				}
			);
		}
	);
}

function savePackageSessionNumber(
	ctx: MutationCtx,
	allocation: Extract<PackageSessionNumberAllocation, { kind: "new" }>
): ResultAsync<number, PackageSessionNumberError> {
	if (allocation.existingSession !== null) {
		return okOrThrow(
			ctx.db
				.patch(allocation.existingSession._id, {
					packageSessionNumber: allocation.number,
					updatedAt: Date.now()
				})
				.then(() => allocation.number)
		);
	}
	if (allocation.booking.driveClientId === undefined) {
		return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}
	return okOrThrow(
		ctx.db
			.insert("driveSessions", {
				bookingId: allocation.booking._id,
				driveClientId: allocation.booking.driveClientId,
				packageSessionNumber: allocation.number,
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.then(() => allocation.number)
	);
}

// Numbers of sessions with a saved number stay reserved even when cancelled, because their
// folders already exist in Drive.
async function loadSavedPackageSessionNumbers(
	ctx: MutationCtx,
	multiBookingId: Id<"multiBookingPackages">
) {
	const savedNumbers = new Set<number>();
	const packageBookings = await loadPackageBookings(ctx, multiBookingId);
	for (const packageBooking of packageBookings) {
		const driveSession = await ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
			.unique();
		if (driveSession?.packageSessionNumber !== undefined) {
			savedNumbers.add(driveSession.packageSessionNumber);
		}
	}
	return savedNumbers;
}

async function loadSharedPackageFolder(
	ctx: QueryCtx,
	packageId: Id<"multiBookingPackages">,
	currentBookingId: Id<"bookings">
) {
	const packageBookings = await loadPackageBookings(ctx, packageId);
	for (const packageBooking of packageBookings) {
		if (packageBooking._id === currentBookingId) continue;
		const driveSession = await ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", packageBooking._id))
			.unique();
		if (driveSession?.packageFolder !== undefined) return driveSession.packageFolder;
	}
	return undefined;
}

async function loadPackageBookings(ctx: QueryCtx, multiBookingId: Id<"multiBookingPackages">) {
	return await ctx.db
		.query("bookings")
		.withIndex("by_multiBookingPackageId", (query) =>
			query.eq("multiBookingPackageId", multiBookingId)
		)
		.collect();
}

async function loadPackageSessionsSortedByDate(
	ctx: MutationCtx,
	multiBookingId: Id<"multiBookingPackages">
) {
	return (await loadPackageBookings(ctx, multiBookingId))
		.filter((packageBooking) => packageBooking.status !== "cancelled")
		.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}

export type ClearSavedDriveFolderArgs =
	| { kind: "client"; driveClientId: Id<"driveClients"> }
	| { kind: "assets"; driveClientId: Id<"driveClients"> }
	| { kind: "package"; bookingId: Id<"bookings"> }
	| { kind: "session"; bookingId: Id<"bookings"> }
	| { kind: "child"; bookingId: Id<"bookings">; name: DriveChildFolderName };

export function clearSavedDriveFolder(ctx: MutationCtx, args: ClearSavedDriveFolderArgs) {
	switch (args.kind) {
		case "client":
			return okOrThrow(
				ctx.db
					.patch(args.driveClientId, { folderId: undefined, folderUrl: undefined })
					.then(() => null)
			);
		case "assets":
			return okOrThrow(
				ctx.db.patch(args.driveClientId, { assetsFolder: undefined }).then(() => null)
			);
		case "package":
			return clearDriveSessionFields(ctx, args.bookingId, { packageFolder: undefined });
		case "session":
			return clearDriveSessionFields(ctx, args.bookingId, {
				sessionFolder: undefined,
				rawMediaFolder: undefined,
				deliverablesFolder: undefined
			});
		case "child":
			return clearDriveSessionFields(
				ctx,
				args.bookingId,
				args.name === "Raw Media"
					? { rawMediaFolder: undefined }
					: { deliverablesFolder: undefined }
			);
		default: {
			const _exhaustive: never = args;
			return _exhaustive;
		}
	}
}

function clearDriveSessionFields(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	fields: {
		packageFolder?: undefined;
		sessionFolder?: undefined;
		rawMediaFolder?: undefined;
		deliverablesFolder?: undefined;
	}
) {
	return okOrThrow(
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		return okOrThrow(
			ctx.db.patch(driveSession._id, { ...fields, updatedAt: Date.now() }).then(() => null)
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
		if (booking === null || booking.driveClientId === undefined) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}
		return okOrThrow(ctx.db.get(booking.driveClientId)).andThen((driveClient) => {
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
		if (booking === null || booking.driveClientId === undefined) {
			return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
		}
		return okOrThrow(
			Promise.all([
				ctx.db.get(booking.driveClientId),
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
