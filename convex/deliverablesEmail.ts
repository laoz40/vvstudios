"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { getBookingFromQuery } from "./lib/bookingLookup";
import { action, type ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAdminIdentity } from "./lib/auth";
import { sendBookingDeliverablesEmailForBooking as sendDeliverablesEmail } from "./lib/email";
import { parseGoogleDriveLink } from "./lib/googleDriveLinks";

type SendBookingDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
	driveLink: string;
	emailVariant: "first-time" | "recurring";
};

async function sendDeliverablesEmailForRecord(
	booking: Doc<"bookings">,
	driveLink: string,
	emailVariant: "first-time" | "recurring"
): Promise<
	Result<{ sent: true }, { reason: "INVALID_DRIVE_LINK" } | { reason: "DELIVERABLES_SEND_FAILED" }>
> {
	const parsedDriveLink = parseGoogleDriveLink(driveLink);

	if (!parsedDriveLink) {
		return err({ reason: "INVALID_DRIVE_LINK" });
	}

	try {
		await sendDeliverablesEmail({
			date: booking.date,
			driveLink: parsedDriveLink,
			email: booking.email,
			emailVariant,
			name: booking.name
		});
	} catch (error) {
		console.error("Manual booking deliverables email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			error
		});
		return err({ reason: "DELIVERABLES_SEND_FAILED" });
	}

	return ok({ sent: true });
}

async function sendBookingDeliverablesEmailHandler(
	ctx: ActionCtx,
	args: SendBookingDeliverablesEmailArgs
): Promise<
	Result<
		{ sent: true },
		| { reason: "NOT_AUTHENTICATED" }
		| { reason: "NOT_AUTHORIZED" }
		| { reason: "BOOKING_NOT_FOUND" }
		| { reason: "INVALID_DRIVE_LINK" }
		| { reason: "DELIVERABLES_SEND_FAILED" }
	>
> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromQuery(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	return await sendDeliverablesEmailForRecord(booking, args.driveLink, args.emailVariant);
}

export type SendBookingDeliverablesEmailResult = Awaited<
	ReturnType<typeof sendBookingDeliverablesEmailHandler>
>;

export const sendBookingDeliverablesEmail = action({
	args: {
		bookingId: v.id("bookings"),
		driveLink: v.string(),
		emailVariant: v.union(v.literal("first-time"), v.literal("recurring"))
	},
	handler: sendBookingDeliverablesEmailHandler
});
