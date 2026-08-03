import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { fromConvexTuple } from "#convex/lib/result";

const rescheduleLinkInvalidationBatchSize = 100;
const rescheduleTokenByteLength = 32;
const hexRadix = 16;
const hexByteLength = 2;

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

type ClientSessionRescheduleOptionalArgs = {
	service?: string;
	addons?: string[];
	notes?: string;
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
};

export function buildClientSessionRescheduleOptionalPatch(
	args: ClientSessionRescheduleOptionalArgs
) {
	return {
		...(args.service !== undefined ? { service: args.service } : {}),
		...(args.addons !== undefined ? { addons: args.addons } : {}),
		...(args.notes !== undefined ? { notes: args.notes } : {}),
		...(args.googleCalendarId ? { googleCalendarId: args.googleCalendarId } : {}),
		...(args.googleEventId ? { googleEventId: args.googleEventId } : {}),
		...(args.confirmBooking
			? {
					status: "confirmed" as const,
					bookingConfirmedAt: Date.now(),
					bookingFailureCode: undefined
				}
			: {})
	};
}

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(hexRadix).padStart(hexByteLength, "0")).join("");
}

export function generateRescheduleToken() {
	const bytes = new Uint8Array(rescheduleTokenByteLength);
	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}

export async function hashRescheduleToken(token: string) {
	const encodedToken = new TextEncoder().encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", encodedToken);
	return bytesToHex(new Uint8Array(hashBuffer));
}

export function buildRescheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/reschedule/${encodeURIComponent(token)}`, baseUrl);
	return url.toString();
}

export function getRescheduleUrlForToken(token: string) {
	return buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, token);
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
		ctx.runMutation(internal.sessionReschedule.createActiveRescheduleLink, {
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

export async function createActiveRescheduleLinkForSession({
	session,
	ctx,
	expiresAt,
	now
}: {
	session: Doc<"bookings">;
	ctx: MutationCtx;
	expiresAt: number;
	now: number;
}) {
	await markExistingActiveSessionRescheduleLinksUsed({ ctx, bookingId: session._id, now });

	const token = generateRescheduleToken();
	const tokenHash = await hashRescheduleToken(token);
	const linkId = await ctx.db.insert("bookingRescheduleLinks", {
		bookingId: session._id,
		tokenHash,
		status: "active" as const,
		expiresAt,
		createdAt: now
	});

	return { linkId, token };
}

export async function markExistingActiveSessionRescheduleLinksUsed(args: {
	ctx: MutationCtx;
	bookingId: Id<"bookings">;
	now: number;
}) {
	let invalidatedLinkCount: number;

	// Continue only when a full batch means more active links may remain.
	do {
		const activeLinks = await args.ctx.db
			.query("bookingRescheduleLinks")
			.withIndex("by_bookingId_and_status", (q) =>
				q.eq("bookingId", args.bookingId).eq("status", "active")
			)
			.take(rescheduleLinkInvalidationBatchSize);

		for (const link of activeLinks) {
			await args.ctx.db.patch(link._id, { status: "used", usedAt: args.now });
		}

		invalidatedLinkCount = activeLinks.length;
	} while (invalidatedLinkCount === rescheduleLinkInvalidationBatchSize);
}
