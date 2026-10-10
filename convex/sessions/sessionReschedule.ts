import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	issueRescheduleLink,
	loadPublicFailedSessionByStripeId,
	loadValidRescheduleLinkAndSession,
	lockRescheduleLinkAt,
	markActiveRescheduleLinksUsedForBooking,
	reopenRescheduleLink,
	writeActiveRescheduleLinkForBooking,
	writeAdminRescheduleLink
} from "#convex/sessions/services/sessionReschedule";

export type { RescheduleLinkLookupError } from "#convex/sessions/lib/sessionRescheduleLinks";

export const createPublicFailedSessionRescheduleLink = mutation({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await loadPublicFailedSessionByStripeId(ctx, args.stripeSessionId)
			.andThen((session) => issueRescheduleLink(ctx, session))
			.match(tupleOk, tupleErr)
});

export const createAdminRescheduleLink = mutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => await writeAdminRescheduleLink(ctx, args).match(tupleOk, tupleErr)
});

export const getRescheduleSessionByToken = query({
	args: { token: v.string() },
	handler: async (ctx, args) =>
		await loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token: args.token })
			.map(({ session, link }) => ({
				session: {
					date: session.date,
					time: session.time,
					duration: session.duration,
					service: session.service,
					addons: session.addons,
					name: session.name
				},
				expiresAt: link.expiresAt
			}))
			.match(tupleOk, tupleErr)
});

export const getValidRescheduleLinkAndSession = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: async (ctx, args) =>
		await loadValidRescheduleLinkAndSession(ctx, args).match(tupleOk, tupleErr)
});

export const createActiveRescheduleLink = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: async (ctx, args) =>
		await writeActiveRescheduleLinkForBooking(ctx, args).match(tupleOk, tupleErr)
});

export const markActiveRescheduleLinksUsedForSession = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) =>
		await markActiveRescheduleLinksUsedForBooking(ctx, args).match(tupleOk, tupleErr)
});

export const unlockRescheduleLink = internalMutation({
	args: {
		linkId: v.id("bookingRescheduleLinks"),
		lockedAt: v.number(),
		expiresAt: v.optional(v.number())
	},
	handler: async (ctx, args) => await reopenRescheduleLink(ctx, args).match(tupleOk, tupleErr)
});

export const lockRescheduleLink = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: async (ctx, args) => await lockRescheduleLinkAt(ctx, args).match(tupleOk, tupleErr)
});
