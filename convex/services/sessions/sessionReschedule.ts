import { err, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingRow } from "#convex/lib/sessions/sessionLookup";
import {
	createActiveRescheduleLinkForSession,
	getRescheduleLinkRow,
	hashRescheduleTokenAsync,
	lookupRescheduleLinkByTokenHash,
	patchRescheduleLinkRow,
	rescheduleUrlFromLinkRow,
	validateActiveRescheduleLink,
	validateAdminSessionForReschedule,
	validatePublicFailedSessionForReschedule,
	validateRescheduleLinkSession,
	writeRescheduleLinksUsedForBooking,
	type RescheduleLinkLookupError,
	type ValidRescheduleLinkAndSession
} from "#convex/lib/sessions/sessionRescheduleLinks";
import {
	getSessionByStripeSessionId,
	getSessionFromDb
} from "#convex/services/sessions/sessionLookup";
import { requirePermission } from "#convex/services/auth";

export function issueRescheduleLink(
	ctx: MutationCtx,
	session: Doc<"bookings">
): NeverthrowResultAsync<{ rescheduleUrl: string }, never> {
	return createActiveRescheduleLinkForSession({
		ctx,
		session,
		expiresAt: session.sessionStartAt,
		now: Date.now()
	}).map(rescheduleUrlFromLinkRow);
}

export function loadPublicFailedSessionByStripeId(ctx: MutationCtx, stripeSessionId: string) {
	return getSessionByStripeSessionId(ctx, stripeSessionId).andThen(
		validatePublicFailedSessionForReschedule
	);
}

export function writeActiveRescheduleLinkForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; expiresAt: number; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		createActiveRescheduleLinkForSession({ session, ctx, expiresAt: args.expiresAt, now: args.now })
	);
}

export function markActiveRescheduleLinksUsedForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() =>
		writeRescheduleLinksUsedForBooking(ctx, args)
	);
}

export function loadValidRescheduleLinkAndSession(
	ctx: QueryCtx,
	args: { now: number; token: string }
): NeverthrowResultAsync<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
	return hashRescheduleTokenAsync(args.token)
		.andThen((tokenHash: string) => lookupRescheduleLinkByTokenHash(ctx, tokenHash))
		.andThen(validateActiveRescheduleLink)
		.andThen((link: Doc<"bookingRescheduleLinks">) =>
			getBookingRow(ctx, link.bookingId).andThen((session) =>
				validateRescheduleLinkSession(args, { link, session })
			)
		);
}

export function writeAdminRescheduleLink(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermission(ctx, "create:reschedule-links")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(validateAdminSessionForReschedule)
		.andThen((session: Doc<"bookings">) => issueRescheduleLink(ctx, session));
}

export function lockRescheduleLinkAt(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return getRescheduleLinkRow(ctx, args.linkId)
		.andThen(validateActiveRescheduleLink)
		.andThen(() => patchRescheduleLinkRow(ctx, args.linkId, { status: "used", usedAt: args.now }));
}

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

type UnlockRescheduleLinkPatch = { status: "active"; usedAt: undefined; expiresAt?: number };

function unlockRescheduleLinkIfLocked(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number },
	link: Doc<"bookingRescheduleLinks"> | null
) {
	if (link === null) {
		return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (link.status !== "used" || link.usedAt !== args.lockedAt) {
		return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_USED" });
	}

	const patch: UnlockRescheduleLinkPatch = { status: "active", usedAt: undefined };

	if (args.expiresAt !== undefined) {
		patch.expiresAt = args.expiresAt;
	}

	return patchRescheduleLinkRow(ctx, args.linkId, patch);
}

export function reopenRescheduleLink(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return getRescheduleLinkRow(ctx, args.linkId).andThen((link) =>
		unlockRescheduleLinkIfLocked(ctx, args, link)
	);
}
