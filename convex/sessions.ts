import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { detectDeliverablesCustomerType as detectCustomerType } from "#convex/lib/editorSessions";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	getDriveSetup as loadDriveSetup,
	saveDriveChildFolder as saveDriveChildFolderRecord,
	saveDriveClientFolder as saveDriveClientFolderRecord,
	saveDriveSessionFolder as saveDriveSessionFolderRecord
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
	submitSessionForReviewService,
	updateSessionEditStatusService,
	updateSessionPaidStatusService
} from "#convex/services/sessions";

const savedDriveFolderValidator = v.object({
	id: v.string(),
	name: v.string(),
	webViewLink: v.string()
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

export const saveDriveChildFolder = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		name: v.union(v.literal("Raw Media"), v.literal("Assets"), v.literal("Deliverables")),
		folder: savedDriveFolderValidator
	},
	handler: (ctx, args) => saveDriveChildFolderRecord(ctx, args).match(tupleOk, tupleErr)
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

export const submitSessionForReview = mutation({
	args: { bookingId: v.id("bookings"), driveLink: v.string(), clientNotes: v.string() },
	handler: (ctx, args) => submitSessionForReviewService(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionCalendarEventDeletedService(ctx, args).match(tupleOk, tupleErr)
});
