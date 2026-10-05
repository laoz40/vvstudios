"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/lib/email/emailTemplateSenders";
import {
	ensureAnyoneReaderPermission,
	listDriveFolderChildren,
	loadDriveClient,
	type DriveError
} from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

export type SendSessionDeliverablesEmailArgs = { bookingId: Id<"bookings">; editorNotes?: string };

export type SendDeliverablesError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" }
	| { reason: "SESSION_NOT_CONFIRMED" }
	| { reason: "SESSION_NOT_IN_PAST" }
	| { reason: "DELIVERABLES_FOLDER_EMPTY" }
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
	| DriveError;

function grantGuestViewerLink(folder: { id: string; url: string }) {
	return loadDriveClient()
		.andThen((drive) => ensureAnyoneReaderPermission(drive, folder.id))
		.map(() => folder);
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return fromConvexTuple(
		ctx.runQuery(internal.internal.sessionsDrive.getDriveSetup, { bookingId })
	).andThen((setupInfo) => {
		const deliverablesFolder = setupInfo?.driveSession?.deliverablesFolder;

		if (deliverablesFolder === undefined) {
			return errAsync({ reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const });
		}

		return okAsync(deliverablesFolder);
	});
}

function requireDeliverablesFolderContents(folder: { id: string; url: string }) {
	return loadDriveClient()
		.andThen((drive) => listDriveFolderChildren(drive, folder.id))
		.andThen((children) => {
			if (children.length === 0) {
				return errAsync({ reason: "DELIVERABLES_FOLDER_EMPTY" as const });
			}

			return okAsync(folder);
		});
}

export function skipWhenDeliverablesEditAlreadyCompleted(
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings"> | null, never> {
	if (session.editStatus === "completed") {
		return okAsync(null);
	}

	return okAsync(session);
}

export function loadDeliverablesFolderGuestReadLink(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<{ id: string; url: string }, SendDeliverablesError> {
	return requireSavedDeliverablesFolder(bookingId, ctx)
		.andThen(requireDeliverablesFolderContents)
		.andThen((folder) => grantGuestViewerLink(folder));
}

export function sendDeliverablesEmailForSession(
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
