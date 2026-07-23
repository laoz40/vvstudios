import { ok } from "../../src/lib/result";
import type { Doc, Id } from "../_generated/dataModel";
import { env } from "../env";
import type { MutationCtx } from "../_generated/server";
import type { SessionAvailabilitySettings } from "./sessionCalendarTime";
import { sendBookingInvoiceEmailsForBooking } from "./email";

const rescheduleLinkInvalidationBatchSize = 100;
const rescheduleTokenByteLength = 32;
const hexRadix = 16;
const hexByteLength = 2;

export type SessionRescheduleLinkStatus = "active" | "used" | "expired";

type SessionRescheduleLink = { expiresAt: number };

type ReschedulableSession = { sessionStartAt: number };

type RescheduleSessionArgs = { date: string; time: string; token: string };

type RescheduledSessionTimingUpdate = {
	googleCalendarId?: string;
	googleEventId?: string;
	sessionStartAt: number;
};

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

export async function finishRescheduledSession(
	session: Doc<"bookings">,
	args: RescheduleSessionArgs,
	timingUpdate: RescheduledSessionTimingUpdate,
	settings: SessionAvailabilitySettings
) {
	const updatedBooking = {
		...session,
		date: args.date,
		time: args.time,
		sessionStartAt: timingUpdate.sessionStartAt,
		googleCalendarId: timingUpdate.googleCalendarId ?? session.googleCalendarId,
		googleEventId: timingUpdate.googleEventId ?? session.googleEventId
	};
	const [emailError] = await sendBookingInvoiceEmailsForBooking(updatedBooking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl: getRescheduleUrlForToken(args.token)
	});

	if (emailError !== null) {
		return ok({ bookingId: session._id, warning: "INVOICE_SEND_FAILED" as const });
	}

	return ok({ bookingId: session._id });
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
