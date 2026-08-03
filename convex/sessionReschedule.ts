import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Doc } from "./_generated/dataModel";
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
	handler: createPublicFailedSessionRescheduleLinkHandler
});

async function createPublicFailedSessionRescheduleLinkHandler(
	ctx: Parameters<typeof createPublicFailedSessionRescheduleLinkService>[0],
	args: { stripeSessionId: string }
) {
	return await createPublicFailedSessionRescheduleLinkService(ctx, args).match(tupleOk, tupleErr);
}

export type CreatePublicFailedSessionRescheduleLinkResult = Awaited<
	ReturnType<typeof createPublicFailedSessionRescheduleLinkHandler>
>;

export const createAdminRescheduleLink = mutation({
	args: { bookingId: v.id("bookings") },
	handler: createAdminRescheduleLinkHandler
});

async function createAdminRescheduleLinkHandler(
	ctx: Parameters<typeof createAdminRescheduleLinkService>[0],
	args: { bookingId: Doc<"bookings">["_id"] }
) {
	return await createAdminRescheduleLinkService(ctx, args).match(tupleOk, tupleErr);
}

export type CreateAdminRescheduleLinkResult = Awaited<
	ReturnType<typeof createAdminRescheduleLinkHandler>
>;

export const getRescheduleSessionByToken = query({
	args: { token: v.string() },
	handler: getRescheduleSessionByTokenHandler
});

async function getRescheduleSessionByTokenHandler(
	ctx: Parameters<typeof getRescheduleSessionByTokenService>[0],
	args: { token: string }
) {
	return await getRescheduleSessionByTokenService(ctx, args).match(tupleOk, tupleErr);
}

export type GetRescheduleSessionByTokenResult = Awaited<
	ReturnType<typeof getRescheduleSessionByTokenHandler>
>;

export const getValidRescheduleLinkAndSession = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: getValidRescheduleLinkAndSessionHandler
});

async function getValidRescheduleLinkAndSessionHandler(
	ctx: Parameters<typeof getValidRescheduleLinkAndSessionService>[0],
	args: { now: number; token: string }
) {
	return await getValidRescheduleLinkAndSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type GetValidRescheduleLinkAndSessionResult = Awaited<
	ReturnType<typeof getValidRescheduleLinkAndSessionHandler>
>;

export const createActiveRescheduleLink = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: createActiveRescheduleLinkHandler
});

async function createActiveRescheduleLinkHandler(
	ctx: Parameters<typeof createActiveRescheduleLinkService>[0],
	args: { bookingId: Doc<"bookings">["_id"]; expiresAt: number; now: number }
) {
	return await createActiveRescheduleLinkService(ctx, args).match(tupleOk, tupleErr);
}

export const markActiveRescheduleLinksUsedForSession = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: markActiveRescheduleLinksUsedForSessionHandler
});

async function markActiveRescheduleLinksUsedForSessionHandler(
	ctx: Parameters<typeof markActiveRescheduleLinksUsedForSessionService>[0],
	args: { bookingId: Doc<"bookings">["_id"]; now: number }
) {
	return await markActiveRescheduleLinksUsedForSessionService(ctx, args).match(tupleOk, tupleErr);
}

export const unlockRescheduleLink = internalMutation({
	args: {
		linkId: v.id("bookingRescheduleLinks"),
		lockedAt: v.number(),
		expiresAt: v.optional(v.number())
	},
	handler: unlockRescheduleLinkHandler
});

async function unlockRescheduleLinkHandler(
	ctx: Parameters<typeof unlockRescheduleLinkService>[0],
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return await unlockRescheduleLinkService(ctx, args).match(tupleOk, tupleErr);
}

export const lockRescheduleLink = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: lockRescheduleLinkHandler
});

async function lockRescheduleLinkHandler(
	ctx: Parameters<typeof lockRescheduleLinkService>[0],
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return await lockRescheduleLinkService(ctx, args).match(tupleOk, tupleErr);
}
