import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { detectDeliverablesCustomerType as detectCustomerType } from "#convex/lib/editorSessions";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	allocatePackageSessionNumber as allocatePackageSessionNumberRecord,
	claimClientAssetsEmail as claimClientAssetsEmailRecord,
	clearSavedDriveFolder as clearSavedDriveFolderRecord,
	getDriveSetup as loadDriveSetup,
	saveClientAssetsEmailResult as saveClientAssetsEmailResultRecord,
	saveClientDrivePermission as saveClientDrivePermissionRecord,
	saveClientDrivePermissionsStatus as saveClientDrivePermissionsStatusRecord,
	saveDriveClientAssetsFolder as saveDriveClientAssetsFolderRecord,
	saveDriveChildFolder as saveDriveChildFolderRecord,
	saveDriveClientFolder as saveDriveClientFolderRecord,
	saveDrivePackageFolder as saveDrivePackageFolderRecord,
	saveDriveSessionFolder as saveDriveSessionFolderRecord,
	saveDriveSetupResult as saveDriveSetupResultRecord
} from "#convex/lib/driveRecords";
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
} from "#convex/lib/driveRecords";
import {
	archiveSessionService,
	assignSessionEditorService,
	buildPublicSessionStatusResponse,
	getDeliverablesCustomerTypeService,
	getDriveStatusService,
	getPublicRescheduleCompleteSessionService,
	listActiveEditorsService,
	listEditorSessionsService,
	listSessionsService,
	markSessionCalendarEventDeletedService,
	saveSessionInstagramHandleService,
	updateSessionAdminNotesService,
	updateSessionNotesService,
	updateSessionEditStatusService,
	updateSessionPaidStatusService
} from "#convex/services/sessions";

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

export const saveDrivePackageFolder = internalMutation({
	args: { bookingId: v.id("bookings"), folder: savedDriveFolderValidator },
	handler: (ctx, args) => saveDrivePackageFolderRecord(ctx, args).match(tupleOk, tupleErr)
});

export const allocatePackageSessionNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => allocatePackageSessionNumberRecord(ctx, args).match(tupleOk, tupleErr)
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

export const detectDeliverablesCustomerType = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.bookingId);
		if (session === null) {
			return tupleErr({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return detectCustomerType(ctx, session).match(tupleOk, tupleErr);
	}
});

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.bookingId);
	}
});

export const getDriveStatus = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => getDriveStatusService(ctx, args).match(tupleOk, tupleErr)
});

export const getDeliverablesCustomerType = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => getDeliverablesCustomerTypeService(ctx, args).match(tupleOk, tupleErr)
});

export const listSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, args) => listSessionsService(ctx, args)
});

export const listActiveEditors = query({
	args: {},
	handler: (ctx) =>
		listActiveEditorsService(ctx).match(
			(editors) => editors,
			(error) => {
				throw new ConvexError(error);
			}
		)
});

export const listEditorSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	// Paginated queries must return Convex's native page shape, so authorization errors throw.
	handler: (ctx, args) =>
		listEditorSessionsService(ctx, args).match(
			(sessionsPage) => sessionsPage,
			(error) => {
				throw new ConvexError(error);
			}
		)
});

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: (ctx, args) =>
		getPublicRescheduleCompleteSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const getSessionStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();

		if (!session) return null;

		return buildPublicSessionStatusResponse(session);
	}
});

export const saveSessionInstagramHandle = mutation({
	args: { stripeSessionId: v.string(), instagramHandle: v.string() },
	handler: (ctx, args) => saveSessionInstagramHandleService(ctx, args).match(tupleOk, tupleErr)
});

export const assignSessionEditor = mutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.union(v.string(), v.null()),
		adminNotes: v.string()
	},
	handler: (ctx, args) => assignSessionEditorService(ctx, args).match(tupleOk, tupleErr)
});

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) => archiveSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionPaidStatus = mutation({
	args: { bookingId: v.id("bookings"), paidRemainingBalance: v.boolean() },
	handler: (ctx, args) => updateSessionPaidStatusService(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionAdminNotes = mutation({
	args: { bookingId: v.id("bookings"), adminNotes: v.string() },
	handler: (ctx, args) => updateSessionAdminNotesService(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionNotes = mutation({
	args: { bookingId: v.id("bookings"), editorNotes: v.string() },
	handler: (ctx, args) => updateSessionNotesService(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(
			v.literal("to_edit"),
			v.literal("editing"),
			v.literal("review"),
			v.literal("completed")
		)
	},
	handler: (ctx, args) => updateSessionEditStatusService(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionCalendarEventDeletedService(ctx, args).match(tupleOk, tupleErr)
});
