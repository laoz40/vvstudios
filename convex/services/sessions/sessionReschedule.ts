import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	createActiveRescheduleLinkForSession,
	getRescheduleUrlForToken,
	hashRescheduleTokenAsync,
	isRescheduleLinkExpired,
	isSessionReschedulable,
	validateActiveRescheduleLink,
	validateAdminSessionForReschedule
} from "#convex/lib/sessions/sessionRescheduleLinks";
import { requirePermission } from "#convex/services/auth";

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

export function issueRescheduleLink(
	ctx: MutationCtx,
	session: Doc<"bookings">
): NeverthrowResultAsync<{ rescheduleUrl: string }, never> {
	return createActiveRescheduleLinkForSession({
		ctx,
		session,
		expiresAt: session.sessionStartAt,
		now: Date.now()
	}).map((link) => ({ rescheduleUrl: getRescheduleUrlForToken(link.token) }));
}

export function loadValidRescheduleLinkAndSession(
	ctx: QueryCtx,
	args: { now: number; token: string }
): NeverthrowResultAsync<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
	return hashRescheduleTokenAsync(args.token)
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
		.andThen((link) =>
			okOrThrow(ctx.db.get("bookings", link.bookingId)).map((session) => ({ link, session }))
		)
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

export function writeAdminRescheduleLink(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "create:reschedule-links")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(validateAdminSessionForReschedule)
		.andThen((session) => issueRescheduleLink(ctx, session));
}

export function lockRescheduleLinkAt(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return okOrThrow(ctx.db.get("bookingRescheduleLinks", args.linkId))
		.andThen(validateActiveRescheduleLink)
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch("bookingRescheduleLinks", args.linkId, { status: "used", usedAt: args.now })
					.then(() => null)
			)
		);
}

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

type UnlockRescheduleLinkPatch = { status: "active"; usedAt: undefined; expiresAt?: number };

export function reopenRescheduleLink(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return okOrThrow(ctx.db.get("bookingRescheduleLinks", args.linkId)).andThen((link) => {
		if (link === null) {
			return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
		}

		// Only unlock a used link with the same lock time set by this request.
		// This prevents an older request from unlocking a newer request's lock.
		if (link.status !== "used" || link.usedAt !== args.lockedAt) {
			return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_USED" });
		}

		const patch: UnlockRescheduleLinkPatch = { status: "active", usedAt: undefined };

		if (args.expiresAt !== undefined) {
			patch.expiresAt = args.expiresAt;
		}

		return okOrThrow(ctx.db.patch("bookingRescheduleLinks", args.linkId, patch).then(() => null));
	});
}
