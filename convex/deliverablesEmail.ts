"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isAdminIdentity } from "./lib/auth";
import { sendBookingDeliverablesEmailForBooking as sendDeliverablesEmail } from "./lib/email";
import { parseGoogleDriveLink } from "./lib/googleDriveLinks";

type SendBookingDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
	driveLink: string;
	emailVariant: "first-time" | "recurring";
};

type SendBookingDeliverablesEmailError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "INVALID_DRIVE_LINK" }
	| { reason: "DELIVERABLES_SEND_FAILED" };

type SendBookingDeliverablesEmailSuccess = { sent: true };

type SendBookingDeliverablesEmailRecordResult = Result<
	SendBookingDeliverablesEmailSuccess,
	Extract<
		SendBookingDeliverablesEmailError,
		{ reason: "INVALID_DRIVE_LINK" | "DELIVERABLES_SEND_FAILED" }
	>
>;

type SendBookingDeliverablesEmailHandlerResult = Result<
	SendBookingDeliverablesEmailSuccess,
	SendBookingDeliverablesEmailError
>;

async function sendDeliverablesEmailForRecord(
	booking: Doc<"bookings">,
	driveLink: string,
	emailVariant: "first-time" | "recurring"
): Promise<SendBookingDeliverablesEmailRecordResult> {
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
): Promise<SendBookingDeliverablesEmailHandlerResult> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	const booking: Doc<"bookings"> | null = await ctx.runQuery(
		internal.bookings.getBookingByIdInternal,
		{ bookingId: args.bookingId }
	);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
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
