import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { tryPromise } from "#convex/lib/result";
import { getBookingRow } from "#convex/lib/sessions/sessionLookup";
import {
	getSessionByStripeSessionId,
	getSessionFromDb
} from "#convex/services/sessions/sessionLookup";
import {
	createActiveRescheduleLinkForSession,
	getRescheduleLinkRow,
	getRescheduleUrlForToken,
	hashRescheduleTokenAsync,
	isRescheduleLinkExpired,
	isSessionReschedulable,
	lookupRescheduleLinkByTokenHash,
	markExistingActiveSessionRescheduleLinksUsed,
	patchRescheduleLinkRow,
	validateActiveRescheduleLink,
	validateAdminSessionForReschedule,
	validatePublicFailedSessionForReschedule
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

function rescheduleUrlFromLinkStep(link: { token: string }) {
	return { rescheduleUrl: getRescheduleUrlForToken(link.token) };
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
	}).map(rescheduleUrlFromLinkStep);
}

export function loadPublicFailedSessionByStripeId(ctx: MutationCtx, stripeSessionId: string) {
	return getSessionByStripeSessionId(ctx, stripeSessionId).andThen(
		validatePublicFailedSessionForReschedule
	);
}

function createRescheduleLinkForSessionStep(
	ctx: MutationCtx,
	args: { expiresAt: number; now: number }
) {
	return (session: Doc<"bookings">) =>
		createActiveRescheduleLinkForSession({
			session,
			ctx,
			expiresAt: args.expiresAt,
			now: args.now
		});
}

export function writeActiveRescheduleLinkForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; expiresAt: number; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(
		createRescheduleLinkForSessionStep(ctx, args)
	);
}

function markActiveLinksUsedStep(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return () =>
		tryPromise({
			try: () =>
				markExistingActiveSessionRescheduleLinksUsed({
					ctx,
					bookingId: args.bookingId,
					now: args.now
				}).then(() => null),
			catch: () => ({ reason: "RESCHEDULE_LINK_UPDATE_FAILED" as const })
		});
}

export function markActiveRescheduleLinksUsedForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(markActiveLinksUsedStep(ctx, args));
}

function requireUsableRescheduleLink(link: Doc<"bookingRescheduleLinks"> | null) {
	if (link === null) return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" as const });

	if (link.status === "used") return err({ reason: "RESCHEDULE_LINK_USED" as const });

	if (link.status === "expired") return err({ reason: "RESCHEDULE_LINK_EXPIRED" as const });

	return ok(link);
}

function pairLinkWithBookingRowStep(link: Doc<"bookingRescheduleLinks">) {
	return (session: Doc<"bookings"> | null) => ({ link, session });
}

function pairLinkWithSessionFromRowStep(ctx: QueryCtx) {
	return (link: Doc<"bookingRescheduleLinks">) =>
		getBookingRow(ctx, link.bookingId).map(pairLinkWithBookingRowStep(link));
}

function lookupRescheduleLinkByTokenHashStep(ctx: QueryCtx) {
	return (tokenHash: string) => lookupRescheduleLinkByTokenHash(ctx, tokenHash);
}

function validateRescheduleLinkSessionStep(args: { now: number }) {
	return ({
		link,
		session
	}: {
		link: Doc<"bookingRescheduleLinks">;
		session: Doc<"bookings"> | null;
	}) => {
		if (session === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

		if (isRescheduleLinkExpired(link, session, args.now)) {
			return err({ reason: "RESCHEDULE_LINK_EXPIRED" as const });
		}

		if (!isSessionReschedulable(session)) {
			return err({ reason: "BOOKING_NOT_RESCHEDULABLE" as const });
		}

		return ok({ session, link });
	};
}

export function loadValidRescheduleLinkAndSession(
	ctx: QueryCtx,
	args: { now: number; token: string }
): NeverthrowResultAsync<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
	return hashRescheduleTokenAsync(args.token)
		.andThen(lookupRescheduleLinkByTokenHashStep(ctx))
		.andThen(requireUsableRescheduleLink)
		.andThen(pairLinkWithSessionFromRowStep(ctx))
		.andThen(validateRescheduleLinkSessionStep(args));
}

function loadSessionForAdminRescheduleStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return () => getSessionFromDb(ctx, bookingId);
}

function issueRescheduleLinkForSessionStep(ctx: MutationCtx) {
	return (session: Doc<"bookings">) => issueRescheduleLink(ctx, session);
}

export function writeAdminRescheduleLink(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "create:reschedule-links")
		.andThen(loadSessionForAdminRescheduleStep(ctx, args.bookingId))
		.andThen(validateAdminSessionForReschedule)
		.andThen(issueRescheduleLinkForSessionStep(ctx));
}

function markRescheduleLinkUsedStep(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return () => patchRescheduleLinkRow(ctx, args.linkId, { status: "used", usedAt: args.now });
}

export function lockRescheduleLinkAt(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return getRescheduleLinkRow(ctx, args.linkId)
		.andThen(validateActiveRescheduleLink)
		.andThen(markRescheduleLinkUsedStep(ctx, args));
}

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

type UnlockRescheduleLinkPatch = { status: "active"; usedAt: undefined; expiresAt?: number };

function unlockRescheduleLinkIfLockedStep(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return (link: Doc<"bookingRescheduleLinks"> | null) => {
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

		return patchRescheduleLinkRow(ctx, args.linkId, patch);
	};
}

export function reopenRescheduleLink(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return getRescheduleLinkRow(ctx, args.linkId).andThen(
		unlockRescheduleLinkIfLockedStep(ctx, args)
	);
}
