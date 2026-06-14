import { err, ok, type Result } from "../../src/lib/result";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const rescheduleTokenByteLength = 32;
const hexRadix = 16;
const hexByteLength = 2;

export type BookingRescheduleLinkStatus = "active" | "used" | "expired";

type BookingRescheduleLink = { expiresAt: number };

type ReschedulableBooking = { sessionStartAt: number };
export type RescheduleLinkLookupError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" };

export interface ValidRescheduleLinkAndBooking {
	booking: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
}

function isBookingReschedulable(booking: Doc<"bookings">, now: number) {
	const isConfirmedBooking = booking.status === "confirmed" || booking.status === "email_failed";

	if (!isConfirmedBooking) {
		return false;
	}

	return now < booking.sessionStartAt;
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

export function isRescheduleLinkExpired(
	link: Pick<BookingRescheduleLink, "expiresAt">,
	booking: ReschedulableBooking,
	now: number
) {
	return now >= link.expiresAt || now >= booking.sessionStartAt;
}

export async function markExistingActiveRescheduleLinksUsed(args: {
	ctx: MutationCtx;
	bookingId: Id<"bookings">;
	now: number;
}) {
	const activeLinks = await args.ctx.db
		.query("bookingRescheduleLinks")
		.withIndex("by_bookingId_and_status", (q) =>
			q.eq("bookingId", args.bookingId).eq("status", "active")
		)
		.take(100);

	for (const link of activeLinks) {
		await args.ctx.db.patch(link._id, { status: "used", usedAt: args.now });
	}
}

export async function getValidRescheduleLinkAndBooking(
	ctx: QueryCtx,
	token: string,
	now: number
): Promise<Result<ValidRescheduleLinkAndBooking, RescheduleLinkLookupError>> {
	const tokenHash = await hashRescheduleToken(token);
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

	const booking = await ctx.db.get(link.bookingId);

	if (booking === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (isRescheduleLinkExpired(link, booking, now)) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	if (!isBookingReschedulable(booking, now)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	return ok({ booking, link });
}
