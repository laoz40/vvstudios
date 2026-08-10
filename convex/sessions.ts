import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	archiveSessionService,
	assignSessionEditorService,
	buildPublicSessionStatusResponse,
	getPublicRescheduleCompleteSessionService,
	listActiveEditorsService,
	listEditorSessionsService,
	listSessionsService,
	markSessionCalendarEventDeletedService,
	saveSessionInstagramHandleService,
	updateSessionEditStatusService,
	updateSessionPaidStatusService
} from "#convex/services/sessions";

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.bookingId);
	}
});

export const listSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, args) => listSessionsService(ctx, args)
});

export const listActiveEditors = query({
	args: {},
	// Admin access is checked before this query runs, so the route error boundary handles any permission error.
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
	args: { bookingId: v.id("bookings"), editorTokenIdentifier: v.union(v.string(), v.null()) },
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

export const updateSessionEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(v.literal("to_edit"), v.literal("editing"), v.literal("completed"))
	},
	handler: (ctx, args) => updateSessionEditStatusService(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionCalendarEventDeletedService(ctx, args).match(tupleOk, tupleErr)
});
