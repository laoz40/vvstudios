import { v } from "convex/values";
import { ResultAsync } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	createActiveRescheduleLinkForSession,
	markExistingActiveSessionRescheduleLinksUsed,
	validatePublicFailedSessionForReschedule
} from "#convex/lib/sessions/sessionRescheduleLinks";
import {
	issueRescheduleLink,
	loadValidRescheduleLinkAndSession,
	lockRescheduleLinkAt,
	reopenRescheduleLink,
	writeAdminRescheduleLink
} from "#convex/services/sessions/sessionReschedule";

export type { RescheduleLinkLookupError } from "#convex/services/sessions/sessionReschedule";

export const createPublicFailedSessionRescheduleLink = mutation({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await getSessionByStripeSessionId(ctx, args.stripeSessionId)
			.andThen(validatePublicFailedSessionForReschedule)
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
		await getSessionFromDb(ctx, args.bookingId)
			.andThen((session) =>
				createActiveRescheduleLinkForSession({
					session,
					ctx,
					expiresAt: args.expiresAt,
					now: args.now
				})
			)
			.match(tupleOk, tupleErr)
});

export const markActiveRescheduleLinksUsedForSession = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) =>
		await getSessionFromDb(ctx, args.bookingId)
			.andThen(() =>
				ResultAsync.fromPromise(
					markExistingActiveSessionRescheduleLinksUsed({
						ctx,
						bookingId: args.bookingId,
						now: args.now
					}),
					() => ({ reason: "RESCHEDULE_LINK_UPDATE_FAILED" as const })
				).map(() => null)
			)
			.match(tupleOk, tupleErr)
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
