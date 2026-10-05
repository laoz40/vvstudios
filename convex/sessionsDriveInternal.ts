import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import * as driveInternal from "#convex/services/drive/driveInternal";

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
	handler: (ctx, args) => driveInternal.getDriveSetup(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveDriveClientFolder = internalMutation({
	args: { normalizedEmail: v.string(), displayName: v.string(), folder: savedDriveFolderValidator },
	handler: (ctx, args) => driveInternal.saveDriveClientFolder(ctx, args).match(tupleOk, tupleErr)
});

export const saveDriveSessionFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		driveClientId: v.id("driveClients"),
		folder: savedDriveFolderValidator
	},
	handler: (ctx, args) => driveInternal.saveDriveSessionFolder(ctx, args).match(tupleOk, tupleErr)
});

export const syncBookingDriveClientIdFromSession = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.syncBookingDriveClientIdFromSession(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveDrivePackageFolder = internalMutation({
	args: { bookingId: v.id("bookings"), folder: savedDriveFolderValidator },
	handler: (ctx, args) => driveInternal.saveDrivePackageFolder(ctx, args).match(tupleOk, tupleErr)
});

export const allocatePackageSessionNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.allocatePackageSessionNumber(ctx, args).match(tupleOk, tupleErr)
});

export const allocateClientSessionNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.allocateClientSessionNumber(ctx, args).match(tupleOk, tupleErr)
});

export const linkBookingDriveClient = internalMutation({
	args: { bookingId: v.id("bookings"), driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		driveInternal
			.linkBookingDriveClient(ctx, args.bookingId, args.driveClientId)
			.match(tupleOk, tupleErr)
});

export const saveDriveClientAssetsFolder = internalMutation({
	args: { driveClientId: v.id("driveClients"), folder: savedDriveFolderValidator },
	handler: (ctx, args) =>
		driveInternal.saveDriveClientAssetsFolder(ctx, args).match(tupleOk, tupleErr)
});

export const saveDriveSetupResult = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.optional(v.string()) },
	handler: (ctx, args) => driveInternal.saveDriveSetupResult(ctx, args).match(tupleOk, tupleErr)
});

export const clearDriveClientFolder = internalMutation({
	args: { driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		driveInternal.clearSavedDriveFolder(ctx, { kind: "client", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveClientAssetsFolder = internalMutation({
	args: { driveClientId: v.id("driveClients") },
	handler: (ctx, args) =>
		driveInternal.clearSavedDriveFolder(ctx, { kind: "assets", ...args }).match(tupleOk, tupleErr)
});

export const clearDrivePackageFolder = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.clearSavedDriveFolder(ctx, { kind: "package", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveSessionFolder = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.clearSavedDriveFolder(ctx, { kind: "session", ...args }).match(tupleOk, tupleErr)
});

export const clearDriveChildFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Raw Media"), v.literal("Deliverables"))
	},
	handler: (ctx, args) =>
		driveInternal.clearSavedDriveFolder(ctx, { kind: "child", ...args }).match(tupleOk, tupleErr)
});

export const saveDriveChildFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Raw Media"), v.literal("Deliverables")),
		folder: savedDriveFolderValidator
	},
	handler: (ctx, args) => driveInternal.saveDriveChildFolder(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientDrivePermission = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Client folder"), v.literal("Assets")),
		permission: savedDrivePermissionValidator
	},
	handler: (ctx, args) =>
		driveInternal.saveClientDrivePermission(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientDrivePermissionsStatus = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		status: v.union(v.literal("failed"), v.literal("ready"), v.literal("skipped"))
	},
	handler: (ctx, args) =>
		driveInternal.saveClientDrivePermissionsStatus(ctx, args).match(tupleOk, tupleErr)
});

export const claimClientAssetsEmail = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		attempt: v.union(v.literal("automatic"), v.literal("retry")),
		now: v.number()
	},
	handler: (ctx, args) => driveInternal.claimClientAssetsEmail(ctx, args).match(tupleOk, tupleErr)
});

export const saveClientAssetsEmailResult = internalMutation({
	args: {
		assetsFolderId: v.string(),
		bookingId: v.id("bookings"),
		claimedAt: v.number(),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: (ctx, args) =>
		driveInternal.saveClientAssetsEmailResult(ctx, args).match(tupleOk, tupleErr)
});

export const getEditorDriveSetup = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.getEditorDriveSetup(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getEditorDriveAccessToRemove = internalQuery({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string() },
	handler: (ctx, args) =>
		driveInternal.getEditorDriveAccessToRemove(ctx, args).match(tupleOk, tupleErr)
});

export const clearPreviousEditorDriveAccess = internalMutation({
	args: {
		driveClientEditorPermissionId: v.union(v.id("driveClientEditorPermissions"), v.null()),
		driveSessionId: v.id("driveSessions"),
		editorTokenIdentifier: v.string()
	},
	handler: (ctx, args) =>
		driveInternal.clearPreviousEditorDriveAccess(ctx, args).match(tupleOk, tupleErr)
});

export const markPreviousEditorRemovalFailed = internalMutation({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string() },
	handler: (ctx, args) =>
		driveInternal.markPreviousEditorRemovalFailed(ctx, args).match(tupleOk, tupleErr)
});

export const getFailedEditorRemoval = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		driveInternal.getFailedEditorRemoval(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const saveEditorDrivePermission = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.string(),
		name: v.union(v.literal("Assets"), v.literal("Deliverables"), v.literal("Session")),
		permission: savedDrivePermissionValidator
	},
	handler: (ctx, args) =>
		driveInternal.saveEditorDrivePermission(ctx, args).match(tupleOk, tupleErr)
});

export const saveEditorDrivePermissionsStatus = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.string(),
		status: v.union(v.literal("failed"), v.literal("ready"))
	},
	handler: (ctx, args) =>
		driveInternal.saveEditorDrivePermissionsStatus(ctx, args).match(tupleOk, tupleErr)
});

export const claimEditorAssignmentEmail = internalMutation({
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.string(), now: v.number() },
	handler: (ctx, args) =>
		driveInternal.claimEditorAssignmentEmail(ctx, args).match(tupleOk, tupleErr)
});

export const saveEditorAssignmentEmailResult = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		claimedAt: v.number(),
		editorTokenIdentifier: v.string(),
		status: v.union(v.literal("failed"), v.literal("sent"))
	},
	handler: (ctx, args) =>
		driveInternal.saveEditorAssignmentEmailResult(ctx, args).match(tupleOk, tupleErr)
});

export const clearSessionDriveDb = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => driveInternal.clearSessionDriveDb(ctx, args).match(tupleOk, tupleErr)
});
