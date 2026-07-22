import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { env } from "./env";
import { getSessionFromDb } from "./lib/sessionLookup";
import { getAdminIdentity } from "./lib/auth";
import {
	buildRescheduleUrl,
	createActiveRescheduleLinkForSession,
	getRescheduleUrlForToken,
	hashRescheduleToken,
	isRescheduleLinkExpired,
	markExistingActiveSessionRescheduleLinksUsed
} from "./lib/sessionRescheduleLinks";

interface GetRescheduleSessionByTokenArgs {
	token: string;
}

interface RescheduleSessionSummary {
	session: {
		date: string;
		time: string;
		duration: string;
		service: string;
		addons: string[];
		name: string;
	};
	expiresAt: number;
}

export type RescheduleLinkLookupError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" };

interface ValidRescheduleLinkAndSession {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
}

function isSessionReschedulable(session: Doc<"bookings">) {
	if (session.status === "confirmed" || session.status === "email_failed") {
		return true;
	}

	return (
		session.status === "failed" &&
		(session.bookingFailureCode === "BOOKING_TIME_UNAVAILABLE" ||
			session.bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED")
	);
}

export async function createRescheduleUrlForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const now = Date.now();
	const [linkError, link] = await ctx.runMutation(
		internal.sessionReschedule.createActiveRescheduleLink,
		{ bookingId: session._id, expiresAt: session.sessionStartAt, now }
	);

	if (linkError !== null) {
		return err({ reason: "RESCHEDULE_LINK_CREATE_FAILED" });
	}

	return ok(getRescheduleUrlForToken(link.token));
}

export const createPublicFailedSessionRescheduleLink = mutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => createPublicFailedSessionRescheduleLinkHandler(ctx, args)
});

async function createPublicFailedSessionRescheduleLinkHandler(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	const session = await ctx.db
		.query("bookings")
		.withIndex("by_stripeSessionId", (indexQuery) =>
			indexQuery.eq("stripeSessionId", args.stripeSessionId)
		)
		.unique();

	if (session === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (!isSessionReschedulable(session)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (session.status !== "failed") {
		return err({ reason: "BOOKING_NOT_FAILED" });
	}

	if (session.sessionStartAt <= Date.now()) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const now = Date.now();
	const link = await createActiveRescheduleLinkForSession({
		ctx,
		session,
		expiresAt: session.sessionStartAt,
		now
	});

	return ok({
		rescheduleUrl: buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, link.token)
	});
}

export type CreatePublicFailedSessionRescheduleLinkResult = Awaited<
	ReturnType<typeof createPublicFailedSessionRescheduleLinkHandler>
>;

export const createAdminRescheduleLink = mutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => createAdminRescheduleLinkHandler(ctx, args)
});

async function createAdminRescheduleLinkHandler(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"] }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	if (!isSessionReschedulable(session)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (session.sessionStartAt <= Date.now()) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const now = Date.now();
	const link = await createActiveRescheduleLinkForSession({
		ctx,
		session,
		expiresAt: session.sessionStartAt,
		now
	});

	return ok({
		rescheduleUrl: buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, link.token)
	});
}

export type CreateAdminRescheduleLinkResult = Awaited<
	ReturnType<typeof createAdminRescheduleLinkHandler>
>;

export const getRescheduleSessionByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getRescheduleSessionByTokenHandler(ctx, args)
});

async function getRescheduleSessionByTokenHandler(
	ctx: QueryCtx,
	args: GetRescheduleSessionByTokenArgs
): Promise<Result<RescheduleSessionSummary, RescheduleLinkLookupError>> {
	const [lookupError, result]: GetValidRescheduleLinkAndSessionResult = await ctx.runQuery(
		internal.sessionReschedule.getValidRescheduleLinkAndSession,
		{ now: Date.now(), token: args.token }
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const { session, link } = result;

	return ok({
		session: {
			date: session.date,
			time: session.time,
			duration: session.duration,
			service: session.service,
			addons: session.addons,
			name: session.name
		},
		expiresAt: link.expiresAt
	});
}

export type GetRescheduleSessionByTokenResult = Awaited<
	ReturnType<typeof getRescheduleSessionByTokenHandler>
>;

export const getValidRescheduleLinkAndSession = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: (ctx, args) => getValidRescheduleLinkAndSessionHandler(ctx, args)
});

async function getValidRescheduleLinkAndSessionHandler(
	ctx: QueryCtx,
	args: { now: number; token: string }
): Promise<Result<ValidRescheduleLinkAndSession, RescheduleLinkLookupError>> {
	const tokenHash = await hashRescheduleToken(args.token);
	const link = await ctx.db
		.query("bookingRescheduleLinks")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
		.unique();

	if (link === null) {
		return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (link.status === "used") {
		return err({ reason: "RESCHEDULE_LINK_USED" });
	}

	if (link.status === "expired") {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const session = await ctx.db.get(link.bookingId);

	if (session === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (isRescheduleLinkExpired(link, session, args.now)) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	if (!isSessionReschedulable(session)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	return ok({ session, link });
}

type GetValidRescheduleLinkAndSessionResult = Awaited<
	ReturnType<typeof getValidRescheduleLinkAndSessionHandler>
>;

export const createActiveRescheduleLink = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		const link = await createActiveRescheduleLinkForSession({
			session,
			ctx,
			expiresAt: args.expiresAt,
			now: args.now
		});

		return ok(link);
	}
});

export const markActiveRescheduleLinksUsedForSession = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await markExistingActiveSessionRescheduleLinksUsed({
			ctx,
			bookingId: args.bookingId,
			now: args.now
		});

		return ok({ used: true });
	}
});

export const unlockRescheduleLink = internalMutation({
	args: {
		linkId: v.id("bookingRescheduleLinks"),
		lockedAt: v.number(),
		expiresAt: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);

		// Only unlock a used link with the same lock time set by this request.
		// This prevents an older request from unlocking a newer request's lock.
		if (link === null || link.status !== "used" || link.usedAt !== args.lockedAt) {
			return err({ reason: "RESCHEDULE_LINK_USED" });
		}

		await ctx.db.patch(args.linkId, {
			status: "active",
			usedAt: undefined,
			...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {})
		});
		return ok({ reactivated: true });
	}
});

export const lockRescheduleLink = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);

		if (link === null) {
			return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
		}

		if (link.status !== "active") {
			return err({
				reason: link.status === "used" ? "RESCHEDULE_LINK_USED" : "RESCHEDULE_LINK_EXPIRED"
			});
		}

		await ctx.db.patch(args.linkId, { status: "used", usedAt: args.now });
		return ok({ used: true });
	}
});
