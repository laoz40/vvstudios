import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { detectDeliverablesCustomerType as detectCustomerType } from "#convex/lib/editor/editorSessions";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	archivePastDeadCheckoutSessionsService,
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
	updateSessionEditStatusService
} from "#convex/services/sessions/sessions";

export const detectDeliverablesCustomerType = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get("bookings", args.bookingId);

		if (session === null) {
			return tupleErr({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return detectCustomerType(ctx, session).match(tupleOk, tupleErr);
	}
});

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get("bookings", args.bookingId);
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
	args: {
		paginationOpts: paginationOptsValidator,
		sortBy: v.optional(v.union(v.literal("session"), v.literal("createdAt"))),
		sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
		view: v.optional(v.union(v.literal("inbox"), v.literal("all"))),
		includeStale: v.optional(v.boolean()),
		searchQuery: v.optional(v.string())
	},
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

export const archivePastDeadCheckoutSessions = mutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	handler: (ctx, args) => archivePastDeadCheckoutSessionsService(ctx, args).match(tupleOk, tupleErr)
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
