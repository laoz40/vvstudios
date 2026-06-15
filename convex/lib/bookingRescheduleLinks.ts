import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const rescheduleLinkInvalidationBatchSize = 100;
const rescheduleTokenByteLength = 32;
const hexRadix = 16;
const hexByteLength = 2;

export type BookingRescheduleLinkStatus = "active" | "used" | "expired";

type BookingRescheduleLink = { expiresAt: number };

type ReschedulableBooking = { sessionStartAt: number };

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
	while (true) {
		const activeLinks = await args.ctx.db
			.query("bookingRescheduleLinks")
			.withIndex("by_bookingId_and_status", (q) =>
				q.eq("bookingId", args.bookingId).eq("status", "active")
			)
			.take(rescheduleLinkInvalidationBatchSize);

		if (activeLinks.length === 0) {
			return;
		}

		for (const link of activeLinks) {
			await args.ctx.db.patch(link._id, { status: "used", usedAt: args.now });
		}
	}
}
