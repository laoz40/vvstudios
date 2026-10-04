import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import {
	claimClientAssetsEmail as claimClientAssetsEmailRecord,
	saveClientAssetsEmailResult as saveClientAssetsEmailResultRecord,
	saveClientDrivePermission as saveClientDrivePermissionRecord,
	saveClientDrivePermissionsStatus as saveClientDrivePermissionsStatusRecord
} from "#convex/lib/drive/driveClientAccess";
import {
	ensureBookingDriveClientId as ensureBookingDriveClientIdRecord,
	syncBookingDriveClientIdFromSession as syncBookingDriveClientIdFromSessionRecord
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	clearSavedDriveFolder as clearSavedDriveFolderRecord,
	saveDriveClientAssetsFolder as saveDriveClientAssetsFolderRecord,
	saveDriveChildFolder as saveDriveChildFolderRecord,
	saveDriveClientFolder as saveDriveClientFolderRecord,
	saveDrivePackageFolder as saveDrivePackageFolderRecord,
	saveDriveSessionFolder as saveDriveSessionFolderRecord,
	saveDriveSetupResult as saveDriveSetupResultRecord
} from "#convex/lib/drive/driveFolders";
import {
	allocatePackageSessionNumber as allocatePackageSessionNumberRecord,
	allocateClientSessionNumber as allocateClientSessionNumberRecord
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import { clearSessionDriveDb as clearSessionDriveDbRecord } from "#convex/lib/drive/sessionFolders/clearSessionRecords";
import { getDriveSetup as loadDriveSetup } from "#convex/lib/drive/driveLookup";
import {
	claimEditorAssignmentEmail as claimEditorAssignmentEmailRecord,
	clearPreviousEditorDriveAccess as clearPreviousEditorDriveAccessRecord,
	getEditorDriveAccessToRemove as loadEditorDriveAccessToRemove,
	getEditorDriveSetup as loadEditorDriveSetup,
	getFailedEditorRemoval as loadFailedEditorRemovalRecord,
	markPreviousEditorRemovalFailed as markPreviousEditorRemovalFailedRecord,
	saveEditorAssignmentEmailResult as saveEditorAssignmentEmailResultRecord,
	saveEditorDrivePermission as saveEditorDrivePermissionRecord,
	saveEditorDrivePermissionsStatus as saveEditorDrivePermissionsStatusRecord
} from "#convex/lib/drive/driveEditor";

const savedDriveFolderValidator = v.object({
	id: v.string(),
	name: v.string(),
	webViewLink: v.string()
});

const savedDrivePermissionValidator = v.object({
	id: v.string(),
	emailAddress: v.optional(v.string()),
	role: v.union(v.literal("reader"), v.literal("writer"), v.literal("commenter"))
});

export const getDriveSetup = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => loadDriveSetup(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveDriveClientFolder = internalMutation({
	args: { normalizedEmail: v.string(), displayName: v.string(), folder: savedDriveFolderValidator },
	handler: (ctx, args) => saveDriveClientFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveDriveSessionFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		driveClientId: v.id("driveClients"),
		folder: savedDriveFolderValidator
	},
	handler: (ctx, args) => saveDriveSessionFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const syncBookingDriveClientIdFromSession = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		syncBookingDriveClientIdFromSessionRecord(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveDrivePackageFolder = internalMutation({
	args: { bookingId: v.id("bookings"), folder: savedDriveFolderValidator },
	handler: (ctx, args) => saveDrivePackageFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const allocatePackageSessionNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => allocatePackageSessionNumberRecord(ctx, args).match(tupleOk, tupleErr)
});

export const allocateClientSessionNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => allocateClientSessionNumberRecord(ctx, args).match(tupleOk, tupleErr)
});

export const linkBookingDriveClient = internalMutation({
	args: { bookingId: v.id("bookings"), driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		ensureBookingDriveClientIdRecord(ctx, args.bookingId, args.driveClientId).match(
			tupleOk,
			tupleErr
		)
});

export const saveDriveClientAssetsFolder = internalMutation({
	args: { driveClientId: v.id("driveClients"), folder: savedDriveFolderValidator },
	handler: (ctx, args) => saveDriveClientAssetsFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveDriveSetupResult = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.optional(v.string()) },
	handler: (ctx, args) => saveDriveSetupResultRecord(ctx, args).match(tupleOk, tupleErr)
});

export const clearDriveClientFolder = internalMutation({
	args: { driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		clearSavedDriveFolderRecord(ctx, { kind: "client", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveClientAssetsFolder = internalMutation({
	args: { driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		clearSavedDriveFolderRecord(ctx, { kind: "assets", ...args }).match(tupleOk, tupleErr)
});

export const clearDrivePackageFolder = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		clearSavedDriveFolderRecord(ctx, { kind: "package", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveSessionFolder = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		clearSavedDriveFolderRecord(ctx, { kind: "session", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveChildFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Raw Media"), v.literal("Deliverables"))
	},
	handler: (ctx, args) =>
		clearSavedDriveFolderRecord(ctx, { kind: "child", ...args }).match(tupleOk, tupleErr)
});

export const saveDriveChildFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Raw Media"), v.literal("Deliverables")),
		folder: savedDriveFolderValidator
	},
	handler: (ctx, args) => saveDriveChildFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientDrivePermission = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Client folder"), v.literal("Assets")),
		permission: savedDrivePermissionValidator
	},
	handler: (ctx, args) => saveClientDrivePermissionRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientDrivePermissionsStatus = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		status: v.union(v.literal("failed"), v.literal("ready"), v.literal("skipped"))
	},
	handler: (ctx, args) => saveClientDrivePermissionsStatusRecord(ctx, args).match(tupleOk, tupleErr)
});

export const claimClientAssetsEmail = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		attempt: v.union(v.literal("automatic"), v.literal("retry")),
		now: v.number()
	},
	handler: (ctx, args) => claimClientAssetsEmailRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientAssetsEmailResult = internalMutation({
	args: {
		assetsFolderId: v.string(),
		bookingId: v.id("bookings"),
		claimedAt: v.number(),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: (ctx, args) => saveClientAssetsEmailResultRecord(ctx, args).match(tupleOk, tupleErr)
});

export const getEditorDriveSetup = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => loadEditorDriveSetup(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getEditorDriveAccessToRemove = internalQuery({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string() },
	handler: (ctx, args) => loadEditorDriveAccessToRemove(ctx, args).match(tupleOk, tupleErr)
});

export const clearPreviousEditorDriveAccess = internalMutation({
	args: {
		driveClientEditorPermissionId: v.union(v.id("driveClientEditorPermissions"), v.null()),
		driveSessionId: v.id("driveSessions"),
		editorTokenIdentifier: v.string()
	},
	handler: (ctx, args) => clearPreviousEditorDriveAccessRecord(ctx, args).match(tupleOk, tupleErr)
});

export const markPreviousEditorRemovalFailed = internalMutation({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string() },
	handler: (ctx, args) => markPreviousEditorRemovalFailedRecord(ctx, args).match(tupleOk, tupleErr)
});

export const getFailedEditorRemoval = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadFailedEditorRemovalRecord(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveEditorDrivePermission = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.string(),
		name: v.union(v.literal("Assets"), v.literal("Deliverables"), v.literal("Session")),
		permission: savedDrivePermissionValidator
	},
	handler: (ctx, args) => saveEditorDrivePermissionRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveEditorDrivePermissionsStatus = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.string(),
		status: v.union(v.literal("failed"), v.literal("ready"))
	},
	handler: (ctx, args) => saveEditorDrivePermissionsStatusRecord(ctx, args).match(tupleOk, tupleErr)
});

export const claimEditorAssignmentEmail = internalMutation({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string(), now: v.number() },
	handler: (ctx, args) => claimEditorAssignmentEmailRecord(ctx, args).match(tupleOk, tupleErr)
});

export const saveEditorAssignmentEmailResult = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		claimedAt: v.number(),
		editorTokenIdentifier: v.string(),
		status: v.union(v.literal("failed"), v.literal("sent"))
	},
	handler: (ctx, args) => saveEditorAssignmentEmailResultRecord(ctx, args).match(tupleOk, tupleErr)
});

export const clearSessionDriveDb = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => clearSessionDriveDbRecord(ctx, args).match(tupleOk, tupleErr)
});
