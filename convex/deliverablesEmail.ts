"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { sendBookingDeliverablesEmailForBooking as sendDeliverablesEmailForBookingDetails } from "./lib/email";
import { parseGoogleDriveLink } from "./lib/googleDriveLinks";

type BookingDeliverablesEmailErrorCode =
	| "NOT_AUTHENTICATED"
	| "BOOKING_NOT_FOUND"
	| "INVALID_DRIVE_LINK"
	| "DELIVERABLES_SEND_FAILED";

type BookingDeliverablesEmailErrorData = { code: BookingDeliverablesEmailErrorCode };

async function sendBookingDeliverablesEmailForBookingRecord(
	booking: Doc<"bookings">,
	driveLink: string,
	emailVariant: "first-time" | "recurring"
) {
	const parsedDriveLink = parseGoogleDriveLink(driveLink);

	if (!parsedDriveLink) {
		throw new ConvexError<BookingDeliverablesEmailErrorData>({ code: "INVALID_DRIVE_LINK" });
	}

	await sendDeliverablesEmailForBookingDetails({
		date: booking.date,
		driveLink: parsedDriveLink,
		email: booking.email,
		emailVariant,
		name: booking.name
	});
}

export const sendBookingDeliverablesEmailForBooking = action({
	args: {
		bookingId: v.id("bookings"),
		driveLink: v.string(),
		emailVariant: v.union(v.literal("first-time"), v.literal("recurring"))
	},
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		const booking = await ctx.runQuery(internal.bookings.getBookingByIdInternal, {
			bookingId: args.bookingId
		});

		if (!booking) {
			throw new ConvexError<BookingDeliverablesEmailErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		try {
			await sendBookingDeliverablesEmailForBookingRecord(
				booking,
				args.driveLink,
				args.emailVariant
			);
			return { ok: true as const };
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			console.error("Manual booking deliverables email send failed", {
				bookingId: booking._id,
				bookingEmail: booking.email,
				error
			});
			throw new ConvexError<BookingDeliverablesEmailErrorData>({
				code: "DELIVERABLES_SEND_FAILED"
			});
		}
	}
});
