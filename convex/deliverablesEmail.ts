"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "#/lib/result";
import { getSessionFromQueryResult } from "./lib/sessionLookup";
import { action, type ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAdminIdentity } from "./lib/auth";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "./lib/email";
import { parseGoogleDriveLink } from "./lib/googleDriveLinks";

type SendSessionDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
	driveLink: string;
	editorNotes?: string;
	emailVariant: "first-time" | "recurring";
};

async function sendDeliverablesEmailForRecord(
	session: Doc<"bookings">,
	driveLink: string,
	editorNotes: string | undefined,
	emailVariant: "first-time" | "recurring"
): Promise<
	Result<{ sent: true }, { reason: "INVALID_DRIVE_LINK" } | { reason: "DELIVERABLES_SEND_FAILED" }>
> {
	const parsedDriveLink = parseGoogleDriveLink(driveLink);

	if (!parsedDriveLink) {
		return err({ reason: "INVALID_DRIVE_LINK" });
	}

	const [emailError] = await sendDeliverablesEmail({
		date: session.date,
		driveLink: parsedDriveLink,
		editorNotes,
		email: session.email,
		emailVariant,
		name: session.name
	});

	if (emailError !== null) {
		console.error("Manual session deliverables email send failed", {
			bookingId: session._id,
			bookingEmail: session.email,
			reason: emailError.reason
		});
		return err({ reason: "DELIVERABLES_SEND_FAILED" });
	}

	return ok({ sent: true });
}

async function sendSessionDeliverablesEmailHandler(
	ctx: ActionCtx,
	args: SendSessionDeliverablesEmailArgs
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

	const sessionResult = await getSessionFromQueryResult(ctx, args.bookingId);

	if (sessionResult.isErr()) {
		return err(sessionResult.error);
	}

	return await sendDeliverablesEmailForRecord(
		sessionResult.value,
		args.driveLink,
		args.editorNotes,
		args.emailVariant
	);
}

export type SendSessionDeliverablesEmailResult = Awaited<
	ReturnType<typeof sendSessionDeliverablesEmailHandler>
>;

export const sendSessionDeliverablesEmail = action({
	args: {
		bookingId: v.id("bookings"),
		driveLink: v.string(),
		editorNotes: v.optional(v.string()),
		emailVariant: v.union(v.literal("first-time"), v.literal("recurring"))
	},
	handler: sendSessionDeliverablesEmailHandler
});
