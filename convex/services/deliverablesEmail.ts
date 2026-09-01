"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership
} from "#convex/lib/editorSessions";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/lib/email";
import {
	listDriveFolderChildren,
	loadDriveClient,
	type DriveError
} from "#convex/lib/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

export type SendSessionDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
	editorNotes?: string;
};

type SendDeliverablesError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_ARCHIVED" }
	| { reason: "SESSION_NOT_IN_PAST" }
	| { reason: "DELIVERABLES_FOLDER_MISSING" }
	| { reason: "DELIVERABLES_FOLDER_EMPTY" }
	| { reason: "DELIVERABLES_FOLDER_LIST_FAILED" }
	| { reason: "DELIVERABLES_SEND_FAILED" };

function mapFolderListError(error: DriveError): SendDeliverablesError {
	if (error.reason === "GOOGLE_DRIVE_FOLDER_MISSING") {
		return { reason: "DELIVERABLES_FOLDER_MISSING" };
	}
	return { reason: "DELIVERABLES_FOLDER_LIST_FAILED" };
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return fromConvexTuple(ctx.runQuery(internal.sessions.getDriveSetup, { bookingId })).andThen(
		(setupInfo) => {
			const deliverablesFolder = setupInfo?.driveSession?.deliverablesFolder;
			if (deliverablesFolder === undefined) {
				return errAsync({ reason: "DELIVERABLES_FOLDER_MISSING" as const });
			}
			return okAsync(deliverablesFolder);
		}
	);
}

function requireDeliverablesFolderContents(folder: { id: string; url: string }) {
	return loadDriveClient()
		.andThen((drive) => listDriveFolderChildren(drive, folder.id))
		.mapErr(mapFolderListError)
		.andThen((children) => {
			if (children.length === 0) {
				return errAsync({ reason: "DELIVERABLES_FOLDER_EMPTY" as const });
			}
			return okAsync(folder);
		});
}

function sendDeliverablesEmailForSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	folderUrl: string,
	editorNotes: string | undefined
): ResultAsync<null, SendDeliverablesError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.detectDeliverablesCustomerType, { bookingId: session._id })
	)
		.andThen((emailVariant) =>
			sendDeliverablesEmail({
				date: session.date,
				driveLink: folderUrl,
				editorNotes,
				email: session.email,
				emailVariant,
				name: session.name
			})
		)
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
): ResultAsync<null, SendDeliverablesError> {
	return requirePermissionActions(ctx, "send:deliverables-email")
		.andThen((identity) =>
			getSessionFromQuery(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen((access) => requireDeliverablesEligibility(access))
		.andThen((session) => {
			// A session already marked completed was delivered. Skip a second email until it leaves completed.
			if (session.editStatus === "completed") {
				return okAsync(null);
			}

			return requireSavedDeliverablesFolder(session._id, ctx)
				.andThen(requireDeliverablesFolderContents)
				.andThen((folder) =>
					sendDeliverablesEmailForSession(ctx, session, folder.url, args.editorNotes)
				);
		});
}
