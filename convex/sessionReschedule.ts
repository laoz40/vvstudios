import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
	createActiveRescheduleLinkService,
	createAdminRescheduleLinkService,
	createPublicFailedSessionRescheduleLinkService,
	getRescheduleSessionByTokenService,
	getValidRescheduleLinkAndSessionService,
	lockRescheduleLinkService,
	markActiveRescheduleLinksUsedForSessionService,
	unlockRescheduleLinkService
} from "./services/sessionReschedule";

export type { RescheduleLinkLookupError } from "./services/sessionReschedule";

export const createPublicFailedSessionRescheduleLink = mutation({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await createPublicFailedSessionRescheduleLinkService(ctx, args).match(tupleOk, tupleErr)
});

export const createAdminRescheduleLink = mutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		await createAdminRescheduleLinkService(ctx, args).match(tupleOk, tupleErr)
});

export const getRescheduleSessionByToken = query({
	args: { token: v.string() },
	handler: async (ctx, args) =>
		await getRescheduleSessionByTokenService(ctx, args).match(tupleOk, tupleErr)
});

export const getValidRescheduleLinkAndSession = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: async (ctx, args) =>
		await getValidRescheduleLinkAndSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const createActiveRescheduleLink = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: async (ctx, args) =>
		await createActiveRescheduleLinkService(ctx, args).match(tupleOk, tupleErr)
});

export const markActiveRescheduleLinksUsedForSession = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) =>
		await markActiveRescheduleLinksUsedForSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const unlockRescheduleLink = internalMutation({
	args: {
		linkId: v.id("bookingRescheduleLinks"),
		lockedAt: v.number(),
		expiresAt: v.optional(v.number())
	},
	handler: async (ctx, args) =>
		await unlockRescheduleLinkService(ctx, args).match(tupleOk, tupleErr)
});

export const lockRescheduleLink = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: async (ctx, args) => await lockRescheduleLinkService(ctx, args).match(tupleOk, tupleErr)
});
