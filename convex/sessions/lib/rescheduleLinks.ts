import { err, ok, type Result, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { bytesToHex } from "#convex/shared/lib/crypto/bytesToHex";
import { fromConvexTuple, okOrThrow } from "#convex/shared/lib/result";

export const RESCHEDULE_LINK_INVALIDATION_BATCH_SIZE = 100;

const rescheduleTokenByteLength = 32;

export type SessionRescheduleLinkStatus = "active" | "used" | "expired";

type SessionRescheduleLink = { expiresAt: number };

type ReschedulableSession = { sessionStartAt: number };

export type CreatePublicFailedSessionRescheduleLinkError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" }
	| { reason: "BOOKING_NOT_FAILED" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" };

export type CreateAdminRescheduleLinkError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" };

export type LockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" };

export type RescheduleLinkLookupError =
	| LockRescheduleLinkError
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" };

export type ValidRescheduleLinkAndSession = {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
};

export function generateRescheduleToken() {
	const bytes = new Uint8Array(rescheduleTokenByteLength);
	crypto.getRandomValues(bytes);

	return bytesToHex(bytes);
}

export function hashRescheduleTokenAsync(token: string): ResultAsync<string, never> {
	const encodedToken = new TextEncoder().encode(token);

	return okOrThrow(
		crypto.subtle
			.digest("SHA-256", encodedToken)
			.then((hashBuffer) => bytesToHex(new Uint8Array(hashBuffer)))
	);
}

export async function hashRescheduleToken(token: string) {
	const result = await hashRescheduleTokenAsync(token);

	if (result.isErr()) throw new Error("hashRescheduleToken failed");

	return result.value;
}

export function buildRescheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/reschedule/${encodeURIComponent(token)}`, baseUrl);

	return url.toString();
}

export function getRescheduleUrlForToken(token: string) {
	return buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, token);
}

export function rescheduleUrlFromLinkRow(link: { token: string }) {
	return { rescheduleUrl: getRescheduleUrlForToken(link.token) };
}

export function validateRescheduleLinkSession(
	args: { now: number },
	{ link, session }: { link: Doc<"bookingRescheduleLinks">; session: Doc<"bookings"> | null }
): Result<ValidRescheduleLinkAndSession, RescheduleLinkLookupError> {
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

export function isSessionReschedulable(session: Doc<"bookings">) {
	if (session.status === "confirmed" || session.status === "email_failed") return true;

	return (
		session.status === "failed" &&
		(session.bookingFailureCode === "BOOKING_TIME_UNAVAILABLE" ||
			session.bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED")
	);
}

export function createRescheduleUrlForSession(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<string, { reason: "BOOKING_NOT_FOUND" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.reschedule.createActiveRescheduleLink, {
			bookingId: session._id,
			expiresAt: session.sessionStartAt,
			now: Date.now()
		})
	).map(({ token }) => getRescheduleUrlForToken(token));
}

export function validatePublicFailedSessionForReschedule(session: Doc<"bookings"> | null) {
	if (session === null) {
		return err<never, CreatePublicFailedSessionRescheduleLinkError>({
			reason: "BOOKING_NOT_FOUND"
		});
	}

	if (!isSessionReschedulable(session)) {
		return err<never, CreatePublicFailedSessionRescheduleLinkError>({
			reason: "BOOKING_NOT_RESCHEDULABLE"
		});
	}

	if (session.status !== "failed") {
		return err<never, CreatePublicFailedSessionRescheduleLinkError>({
			reason: "BOOKING_NOT_FAILED"
		});
	}

	if (session.sessionStartAt <= Date.now()) {
		return err<never, CreatePublicFailedSessionRescheduleLinkError>({
			reason: "RESCHEDULE_LINK_EXPIRED"
		});
	}

	return ok(session);
}

export function validateAdminSessionForReschedule(session: Doc<"bookings">) {
	if (!isSessionReschedulable(session)) {
		return err<never, CreateAdminRescheduleLinkError>({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (session.sessionStartAt <= Date.now()) {
		return err<never, CreateAdminRescheduleLinkError>({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	return ok(session);
}

export function validateActiveRescheduleLink(link: Doc<"bookingRescheduleLinks"> | null) {
	if (link === null) {
		return err<never, LockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (link.status === "used") {
		return err<never, LockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_USED" });
	}

	if (link.status === "expired") {
		return err<never, LockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	return ok(link);
}

export function isRescheduleLinkExpired(
	link: Pick<SessionRescheduleLink, "expiresAt">,
	session: ReschedulableSession,
	now: number
) {
	return now >= link.expiresAt || now >= session.sessionStartAt;
}

export function listActiveRescheduleLinks(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("bookingRescheduleLinks")
			.withIndex("by_bookingId_and_status", (q) =>
				q.eq("bookingId", bookingId).eq("status", "active")
			)
			.take(RESCHEDULE_LINK_INVALIDATION_BATCH_SIZE)
	);
}

export function selectNextRescheduleLinkInvalidationBatches(
	links: Doc<"bookingRescheduleLinks">[],
	args: { bookingId: Id<"bookings">; now: number }
) {
	return links.length >= RESCHEDULE_LINK_INVALIDATION_BATCH_SIZE ? [args] : [];
}

export function markRescheduleLinksUsed(
	ctx: MutationCtx,
	links: Doc<"bookingRescheduleLinks">[],
	now: number
) {
	return okOrThrow(
		Promise.all(
			links.map((link) =>
				ctx.db.patch("bookingRescheduleLinks", link._id, { status: "used", usedAt: now })
			)
		)
	);
}

export function insertActiveRescheduleLink(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; tokenHash: string; expiresAt: number; now: number }
) {
	return okOrThrow(
		ctx.db
			.insert("bookingRescheduleLinks", {
				bookingId: args.bookingId,
				tokenHash: args.tokenHash,
				status: "active" as const,
				expiresAt: args.expiresAt,
				createdAt: args.now
			})
			.then((linkId) => linkId)
	);
}

export function lookupRescheduleLinkByTokenHash(ctx: QueryCtx, tokenHash: string) {
	return okOrThrow(
		ctx.db
			.query("bookingRescheduleLinks")
			.withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
			.unique()
	);
}

export function getRescheduleLinkRow(
	ctx: QueryCtx | MutationCtx,
	linkId: Id<"bookingRescheduleLinks">
) {
	return okOrThrow(ctx.db.get("bookingRescheduleLinks", linkId));
}

export function patchRescheduleLinkRow(
	ctx: MutationCtx,
	linkId: Id<"bookingRescheduleLinks">,
	patch: Partial<Pick<Doc<"bookingRescheduleLinks">, "status" | "usedAt" | "expiresAt">>
) {
	return okOrThrow(ctx.db.patch("bookingRescheduleLinks", linkId, patch).then(() => null));
}
