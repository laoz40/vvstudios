"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/lib/email/emailTemplateSenders";
import { loadSessionForDeliverablesFromAction } from "#convex/services/editor/loadSessionForDeliverables";
import {
	ensureAnyoneReaderPermission,
	listDriveFolderChildren,
	loadDriveClient,
	type DriveError
} from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

export type SendSessionDeliverablesEmailArgs = { bookingId: Id<"bookings">; editorNotes?: string };

type SendDeliverablesError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_NOT_IN_PAST" }
	| { reason: "DELIVERABLES_FOLDER_MISSING" }
	| { reason: "DELIVERABLES_FOLDER_EMPTY" }
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
	| DriveError;

function mapDeliverablesDriveError(error: DriveError): SendDeliverablesError {
	if (error.reason === "GOOGLE_DRIVE_FOLDER_MISSING") {
		return { reason: "DELIVERABLES_FOLDER_MISSING" };
	}

	return error;
}

function grantGuestViewerLink(folder: { id: string; url: string }) {
	return loadDriveClient()
		.andThen((drive) => ensureAnyoneReaderPermission(drive, folder.id))
		.mapErr(mapDeliverablesDriveError)
		.map(() => folder);
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return fromConvexTuple(
		ctx.runQuery(internal.internal.sessionsDrive.getDriveSetup, { bookingId })
	).andThen((setupInfo) => {
		const deliverablesFolder = setupInfo?.driveSession?.deliverablesFolder;

		if (deliverablesFolder === undefined) {
			return errAsync({ reason: "DELIVERABLES_FOLDER_MISSING" as const });
		}

		return okAsync(deliverablesFolder);
	});
}

function requireDeliverablesFolderContents(folder: { id: string; url: string }) {
	return loadDriveClient()
		.andThen((drive) => listDriveFolderChildren(drive, folder.id))
		.mapErr(mapDeliverablesDriveError)
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
		.mapErr((emailError): SendDeliverablesError => {
			console.error("Manual session deliverables email send failed", {
				bookingId: session._id,
				reason: emailError.reason
			});

			return emailError;
		});
}

export function sendSessionDeliverablesEmailService(
	ctx: ActionCtx,
	args: SendSessionDeliverablesEmailArgs
): ResultAsync<null, SendDeliverablesError> {
	return loadSessionForDeliverablesFromAction(ctx, args.bookingId).andThen((session) => {
		// A session already marked completed was delivered. Skip a second email until it leaves completed.
		if (session.editStatus === "completed") {
			return okAsync(null);
		}

		return requireSavedDeliverablesFolder(session._id, ctx)
			.andThen(requireDeliverablesFolderContents)
			.andThen((folder) => grantGuestViewerLink(folder))
			.andThen((folder) =>
				sendDeliverablesEmailForSession(ctx, session, folder.url, args.editorNotes)
			);
	});
}
