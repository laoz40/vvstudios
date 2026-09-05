import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { requirePermission } from "#convex/lib/auth";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessionLookup";
import {
	buildRescheduleUrl,
	createActiveRescheduleLinkForSession,
	hashRescheduleToken,
	isRescheduleLinkExpired,
	isSessionReschedulable,
	markExistingActiveSessionRescheduleLinksUsed,
	validateActiveRescheduleLink,
	validateAdminSessionForReschedule,
	validatePublicFailedSessionForReschedule,
	type CreateAdminRescheduleLinkError,
	type CreatePublicFailedSessionRescheduleLinkError
} from "#convex/lib/sessionRescheduleLinks";

export interface GetRescheduleSessionByTokenArgs {
	token: string;
}

export interface RescheduleSessionSummary {
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

export interface ValidRescheduleLinkAndSession {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
}

export function createPublicFailedSessionRescheduleLinkService(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
): NeverthrowResultAsync<{ rescheduleUrl: string }, CreatePublicFailedSessionRescheduleLinkError> {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen(validatePublicFailedSessionForReschedule)
		.andThen((session) =>
			okOrThrow(
				createActiveRescheduleLinkForSession({
					ctx,
					session,
					expiresAt: session.sessionStartAt,
					now: Date.now()
				})
			).map((link) => ({
				rescheduleUrl: buildRescheduleUrl(
					new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin,
					link.token
				)
			}))
		);
}

export function createAdminRescheduleLinkService(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"] }
): NeverthrowResultAsync<{ rescheduleUrl: string }, CreateAdminRescheduleLinkError> {
	return requirePermission(ctx, "create:reschedule-links")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(validateAdminSessionForReschedule)
		.andThen((session) =>
			okOrThrow(
				createActiveRescheduleLinkForSession({
					ctx,
					session,
					expiresAt: session.sessionStartAt,
					now: Date.now()
				})
			).map((link) => ({
				rescheduleUrl: buildRescheduleUrl(
					new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin,
					link.token
				)
			}))
		);
}

export function getRescheduleSessionByTokenService(
	ctx: QueryCtx,
	args: GetRescheduleSessionByTokenArgs
): NeverthrowResultAsync<RescheduleSessionSummary, RescheduleLinkLookupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
			now: Date.now(),
			token: args.token
		})
	).map(
		({ session, link }): RescheduleSessionSummary => ({
			session: {
				date: session.date,
				time: session.time,
				duration: session.duration,
				service: session.service,
				addons: session.addons,
				name: session.name
			},
			expiresAt: link.expiresAt
		})
	);
}

export function getValidRescheduleLinkAndSessionService(
	ctx: QueryCtx,
	args: { now: number; token: string }
): NeverthrowResultAsync<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
	return okOrThrow(hashRescheduleToken(args.token))
		.andThen((tokenHash) =>
			okOrThrow(
				ctx.db
					.query("bookingRescheduleLinks")
					.withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
					.unique()
			)
		)
		.andThen((link) => {
			if (link === null) return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" as const });
			if (link.status === "used") return err({ reason: "RESCHEDULE_LINK_USED" as const });
			if (link.status === "expired") return err({ reason: "RESCHEDULE_LINK_EXPIRED" as const });
			return ok(link);
		})
		.andThen((link) => okOrThrow(ctx.db.get(link.bookingId)).map((session) => ({ link, session })))
		.andThen(({ link, session }) => {
			if (session === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
			if (isRescheduleLinkExpired(link, session, args.now)) {
				return err({ reason: "RESCHEDULE_LINK_EXPIRED" as const });
			}
			if (!isSessionReschedulable(session)) {
				return err({ reason: "BOOKING_NOT_RESCHEDULABLE" as const });
			}
			return ok({ session, link });
		});
}

export function createActiveRescheduleLinkService(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"]; expiresAt: number; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) =>
		okOrThrow(
			createActiveRescheduleLinkForSession({
				session,
				ctx,
				expiresAt: args.expiresAt,
				now: args.now
			})
		)
	);
}

export function markActiveRescheduleLinksUsedForSessionService(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"]; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			markExistingActiveSessionRescheduleLinksUsed({
				ctx,
				bookingId: args.bookingId,
				now: args.now
			}).then(() => null)
		)
	);
}

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

export function unlockRescheduleLinkService(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return okOrThrow(ctx.db.get(args.linkId)).andThen((link) => {
		if (link === null) {
			return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
		}

		// Only unlock a used link with the same lock time set by this request.
		// This prevents an older request from unlocking a newer request's lock.
		if (link.status !== "used" || link.usedAt !== args.lockedAt) {
			return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_USED" });
		}

		return okOrThrow(
			ctx.db
				.patch(args.linkId, {
					status: "active",
					usedAt: undefined,
					...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {})
				})
				.then(() => null)
		);
	});
}

export function lockRescheduleLinkService(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return okOrThrow(ctx.db.get(args.linkId))
		.andThen(validateActiveRescheduleLink)
		.andThen(() =>
			okOrThrow(ctx.db.patch(args.linkId, { status: "used", usedAt: args.now }).then(() => null))
		);
}
