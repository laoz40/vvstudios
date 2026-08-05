import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "#convex/_generated/server";
import {
	archiveSessionService,
	buildPublicSessionStatusResponse,
	getPublicRescheduleCompleteSessionService,
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
	handler: (ctx, args) => listSessionsHandler(ctx, args)
});

function listSessionsHandler(
	ctx: QueryCtx,
	args: { paginationOpts: { numItems: number; cursor: string | null } }
) {
	return listSessionsService(ctx, args);
}

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: (ctx, args) => getPublicRescheduleCompleteSessionHandler(ctx, args)
});

function getPublicRescheduleCompleteSessionHandler(ctx: QueryCtx, args: { bookingId: string }) {
	return getPublicRescheduleCompleteSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type GetPublicRescheduleCompleteSessionResult = Awaited<
	ReturnType<typeof getPublicRescheduleCompleteSessionHandler>
>;

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
	handler: (ctx, args) => saveSessionInstagramHandleHandler(ctx, args)
});

function saveSessionInstagramHandleHandler(
	ctx: MutationCtx,
	args: { stripeSessionId: string; instagramHandle: string }
) {
	return saveSessionInstagramHandleService(ctx, args).match(tupleOk, tupleErr);
}

export type SaveSessionInstagramHandleResult = Awaited<
	ReturnType<typeof saveSessionInstagramHandleHandler>
>;

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) => archiveSessionHandler(ctx, args)
});

function archiveSessionHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return archiveSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type ArchiveSessionResult = Awaited<ReturnType<typeof archiveSessionHandler>>;

export const updateSessionPaidStatus = mutation({
	args: { bookingId: v.id("bookings"), paidRemainingBalance: v.boolean() },
	handler: (ctx, args) => updateSessionPaidStatusHandler(ctx, args)
});

function updateSessionPaidStatusHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; paidRemainingBalance: boolean }
) {
	return updateSessionPaidStatusService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateSessionPaidStatusResult = Awaited<
	ReturnType<typeof updateSessionPaidStatusHandler>
>;

export const updateSessionEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(v.literal("to_edit"), v.literal("editing"), v.literal("completed"))
	},
	handler: (ctx, args) => updateSessionEditStatusHandler(ctx, args)
});

function updateSessionEditStatusHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "completed" }
) {
	return updateSessionEditStatusService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateSessionEditStatusResult = Awaited<
	ReturnType<typeof updateSessionEditStatusHandler>
>;

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionCalendarEventDeletedHandler(ctx, args)
});

function markSessionCalendarEventDeletedHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return markSessionCalendarEventDeletedService(ctx, args).match(tupleOk, tupleErr);
}

export type MarkSessionCalendarEventDeletedResult = Awaited<
	ReturnType<typeof markSessionCalendarEventDeletedHandler>
>;
