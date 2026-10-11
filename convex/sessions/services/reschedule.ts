import { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingRow } from "#convex/sessions/lib/lookup";
import {
	generateRescheduleToken,
	getRescheduleLinkRow,
	insertActiveRescheduleLink,
	listActiveRescheduleLinks,
	hashRescheduleTokenAsync,
	lookupRescheduleLinkByTokenHash,
	markRescheduleLinksUsed,
	patchRescheduleLinkRow,
	rescheduleUrlFromLinkRow,
	validateActiveRescheduleLink,
	validateAdminSessionForReschedule,
	validatePublicFailedSessionForReschedule,
	validateRescheduleLinkSession,
	selectNextRescheduleLinkInvalidationBatches,
	type RescheduleLinkLookupError,
	type ValidRescheduleLinkAndSession
} from "#convex/sessions/lib/rescheduleLinks";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/sessions/services/lookup";
import { requirePermission } from "#convex/shared/services/auth";
import { unlockRescheduleLinkIfLocked } from "#convex/sessions/lib/rescheduleSteps";

function createActiveRescheduleLinkForSession(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	expiresAt: number,
	now: number
) {
	return writeRescheduleLinksUsedForBooking(ctx, { bookingId: session._id, now }).andThen(() =>
		createNewRescheduleLink(ctx, session, expiresAt, now)
	);
}

function createNewRescheduleLink(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	expiresAt: number,
	now: number
) {
	const token = generateRescheduleToken();

	return hashRescheduleTokenAsync(token)
		.andThen((tokenHash) =>
			insertActiveRescheduleLink(ctx, { bookingId: session._id, tokenHash, expiresAt, now })
		)
		.map((linkId) => ({ linkId, token }));
}

function invalidateNextRescheduleLinksBatch(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
): ResultAsync<null, never> {
	return listActiveRescheduleLinks(ctx, args.bookingId).andThen((activeLinks) =>
		markRescheduleLinksUsed(ctx, activeLinks, args.now).andThen(() => {
			const nextBatches: ResultAsync<null, never>[] = selectNextRescheduleLinkInvalidationBatches(
				activeLinks,
				args
			).map((nextArgs) => invalidateNextRescheduleLinksBatch(ctx, nextArgs));

			return ResultAsync.combine(nextBatches).map(() => null);
		})
	);
}

export function writeRescheduleLinksUsedForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return invalidateNextRescheduleLinksBatch(ctx, args);
}

export function issueRescheduleLink(
	ctx: MutationCtx,
	session: Doc<"bookings">
): ResultAsync<{ rescheduleUrl: string }, never> {
	return createActiveRescheduleLinkForSession(ctx, session, session.sessionStartAt, Date.now()).map(
		rescheduleUrlFromLinkRow
	);
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
		createActiveRescheduleLinkForSession(ctx, session, args.expiresAt, args.now)
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
): ResultAsync<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
	return hashRescheduleTokenAsync(args.token)
		.andThen((tokenHash: string) => lookupRescheduleLinkByTokenHash(ctx, tokenHash))
		.andThen(validateActiveRescheduleLink)
		.andThen((link: Doc<"bookingRescheduleLinks">) =>
			validateLoadedRescheduleLinkSession(ctx, args, link)
		);
}

function validateLoadedRescheduleLinkSession(
	ctx: QueryCtx,
	args: { now: number; token: string },
	link: Doc<"bookingRescheduleLinks">
) {
	return getBookingRow(ctx, link.bookingId).andThen((session) =>
		validateRescheduleLinkSession(args, { link, session })
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

export function reopenRescheduleLink(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return getRescheduleLinkRow(ctx, args.linkId).andThen((link) =>
		unlockRescheduleLinkIfLocked(ctx, args, link)
	);
}
