import { ok, ResultAsync, safeTry } from "neverthrow";
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
	selectNextRescheduleLinkInvalidationBatches
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
	return safeTry(async function* () {
		yield* writeRescheduleLinksUsedForBooking(ctx, { bookingId: session._id, now });

		return ok(yield* createNewRescheduleLink(ctx, session, expiresAt, now));
	});
}

function createNewRescheduleLink(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	expiresAt: number,
	now: number
) {
	const token = generateRescheduleToken();

	return safeTry(async function* () {
		const tokenHash = yield* hashRescheduleTokenAsync(token);

		const linkId = yield* insertActiveRescheduleLink(ctx, {
			bookingId: session._id,
			tokenHash,
			expiresAt,
			now
		});

		return ok({ linkId, token });
	});
}

function invalidateNextRescheduleLinksBatch(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
): ResultAsync<null, never> {
	return safeTry(async function* () {
		const activeLinks = yield* listActiveRescheduleLinks(ctx, args.bookingId);
		yield* markRescheduleLinksUsed(ctx, activeLinks, args.now);

		const nextBatches = selectNextRescheduleLinkInvalidationBatches(activeLinks, args).map(
			(nextArgs) => invalidateNextRescheduleLinksBatch(ctx, nextArgs)
		);

		return ok(yield* ResultAsync.combine(nextBatches).map(() => null));
	});
}

export function writeRescheduleLinksUsedForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return invalidateNextRescheduleLinksBatch(ctx, args);
}

export function issueRescheduleLink(ctx: MutationCtx, session: Doc<"bookings">) {
	return createActiveRescheduleLinkForSession(ctx, session, session.sessionStartAt, Date.now()).map(
		rescheduleUrlFromLinkRow
	);
}

export function loadPublicFailedSessionByStripeId(ctx: MutationCtx, stripeSessionId: string) {
	return safeTry(async function* () {
		const session = yield* getSessionByStripeSessionId(ctx, stripeSessionId);

		return ok(yield* validatePublicFailedSessionForReschedule(session));
	});
}

export function writeActiveRescheduleLinkForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; expiresAt: number; now: number }
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);

		return ok(yield* createActiveRescheduleLinkForSession(ctx, session, args.expiresAt, args.now));
	});
}

export function markActiveRescheduleLinksUsedForBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; now: number }
) {
	return safeTry(async function* () {
		yield* getSessionFromDb(ctx, args.bookingId);

		return ok(yield* writeRescheduleLinksUsedForBooking(ctx, args));
	});
}

export function loadValidRescheduleLinkAndSession(
	ctx: QueryCtx,
	args: { now: number; token: string }
) {
	return safeTry(async function* () {
		const tokenHash = yield* hashRescheduleTokenAsync(args.token);
		const link = yield* lookupRescheduleLinkByTokenHash(ctx, tokenHash);
		const activeLink = yield* validateActiveRescheduleLink(link);

		return ok(yield* validateLoadedRescheduleLinkSession(ctx, args, activeLink));
	});
}

function validateLoadedRescheduleLinkSession(
	ctx: QueryCtx,
	args: { now: number; token: string },
	link: Doc<"bookingRescheduleLinks">
) {
	return safeTry(async function* () {
		const session = yield* getBookingRow(ctx, link.bookingId);

		return ok(yield* validateRescheduleLinkSession(args, { link, session }));
	});
}

export function writeAdminRescheduleLink(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "create:reschedule-links");
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const validatedSession = yield* validateAdminSessionForReschedule(session);

		return ok(yield* issueRescheduleLink(ctx, validatedSession));
	});
}

export function lockRescheduleLinkAt(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; now: number }
) {
	return safeTry(async function* () {
		const link = yield* getRescheduleLinkRow(ctx, args.linkId);
		yield* validateActiveRescheduleLink(link);

		return ok(
			yield* patchRescheduleLinkRow(ctx, args.linkId, { status: "used", usedAt: args.now })
		);
	});
}

export function reopenRescheduleLink(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number }
) {
	return safeTry(async function* () {
		const link = yield* getRescheduleLinkRow(ctx, args.linkId);

		return ok(yield* unlockRescheduleLinkIfLocked(ctx, args, link));
	});
}
