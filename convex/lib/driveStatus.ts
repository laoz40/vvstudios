import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	getDriveSetup,
	loadSharedPackageFolder,
	resolveDriveClientForBooking
} from "#convex/lib/driveLookup";
import type { DriveChildFolderName } from "#convex/lib/googleDrive";
import {
	formatDriveClientFolderName,
	formatDrivePackageFolderName,
	formatDrivePackageSessionFolderName,
	formatDriveSessionFolderName
} from "#studio/lib/bookingdatetime";

type ClientDrivePermissionsDisplayStatus =
	| "failed"
	| "incomplete"
	| "not_created"
	| "ready"
	| "skipped";
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
		case "skipped":
			return "skipped";
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

function buildDriveWorkflowFailureStatus(args: {
	clientDrivePermissions: ReturnType<typeof buildClientDrivePermissionsStatus>;
	editorDrivePermissions: ReturnType<typeof buildEditorDrivePermissionsStatus>;
	folderStatus: ReturnType<typeof buildDriveStatus>;
	previousEditorRemovalFailed: boolean;
}) {
	return hasDriveWorkflowFailure({
		clientDrivePermissions: args.clientDrivePermissions,
		editorDrivePermissions: args.editorDrivePermissions,
		folderStatus: args.folderStatus.status,
		folders: args.folderStatus.folders,
		previousEditorRemovalFailed: args.previousEditorRemovalFailed
	});
}

function getDriveSetupEntities(
	setupInfo: {
		booking: Doc<"bookings"> | null;
		driveClient: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions"> | null;
		multiBookingPackage: Doc<"multiBookingPackages"> | null;
		sharedPackageFolder?: { id: string; url: string };
	} | null
) {
	return {
		booking: setupInfo?.booking ?? null,
		driveClient: setupInfo?.driveClient ?? null,
		driveSession: setupInfo?.driveSession ?? null,
		multiBookingPackage: setupInfo?.multiBookingPackage ?? null,
		sharedPackageFolder: setupInfo?.sharedPackageFolder
	};
}

function buildDriveStatusFromSetup(
	setupInfo: {
		booking: Doc<"bookings"> | null;
		driveClient: Doc<"driveClients"> | null;
		driveSession: Doc<"driveSessions"> | null;
		multiBookingPackage: Doc<"multiBookingPackages"> | null;
		sharedPackageFolder?: { id: string; url: string };
	} | null
) {
	const { booking, driveClient, driveSession, multiBookingPackage, sharedPackageFolder } =
		getDriveSetupEntities(setupInfo);
	const folderStatus = buildDriveStatus({
		booking,
		driveClient,
		driveSession,
		multiBookingPackage,
		driveSetupFailed: booking?.driveSetupFailureCode !== undefined,
		sharedPackageFolder
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
		hasDriveWorkflowFailure: buildDriveWorkflowFailureStatus({
			clientDrivePermissions,
			editorDrivePermissions,
			folderStatus,
			previousEditorRemovalFailed
		}),
		previousEditorRemovalFailed
	};
}

export function getDriveStatus(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).map((setupInfo) => buildDriveStatusFromSetup(setupInfo));
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
