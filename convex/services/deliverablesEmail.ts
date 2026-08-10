"use node";

import { errAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership
} from "#convex/lib/editorSessions";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/lib/email";
import { parseGoogleDriveLink } from "#convex/lib/googleDriveLinks";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

export type SendSessionDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
	driveLink: string;
	editorNotes?: string;
	emailVariant: "first-time" | "recurring";
};

function sendDeliverablesEmailForSession(
	session: Doc<"bookings">,
	args: SendSessionDeliverablesEmailArgs
): ResultAsync<null, { reason: "INVALID_DRIVE_LINK" } | { reason: "DELIVERABLES_SEND_FAILED" }> {
	const parsedDriveLink = parseGoogleDriveLink(args.driveLink);

	if (!parsedDriveLink) {
		return errAsync({ reason: "INVALID_DRIVE_LINK" as const });
	}

	return sendDeliverablesEmail({
		date: session.date,
		driveLink: parsedDriveLink,
		editorNotes: args.editorNotes,
		email: session.email,
		emailVariant: args.emailVariant,
		name: session.name
	})
		.map(() => null)
		.mapErr((emailError) => {
			console.error("Manual session deliverables email send failed", {
				bookingId: session._id,
				reason: emailError.reason
			});
			return { reason: "DELIVERABLES_SEND_FAILED" as const };
		});
}

export function sendSessionDeliverablesEmailService(
	ctx: ActionCtx,
	args: SendSessionDeliverablesEmailArgs
): ResultAsync<
	null,
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_ARCHIVED" }
	| { reason: "SESSION_NOT_IN_PAST" }
	| { reason: "INVALID_DRIVE_LINK" }
	| { reason: "DELIVERABLES_SEND_FAILED" }
> {
	return requirePermissionActions(ctx, "send:deliverables-email")
		.andThen((identity) =>
			getSessionFromQuery(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(requireDeliverablesEligibility)
		.andThen((session) => sendDeliverablesEmailForSession(session, args));
}
