"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/email/services/templateEmails";
import {
	ensureAnyoneReaderPermission,
	listDriveFolderChildren,
	loadDriveClient,
	type DriveClient,
	type DriveError,
	type ListedDriveChild
} from "#convex/drive/lib/googleDrive";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import type { Result as ConvexResult } from "#/lib/result";
import type { DeliverablesCustomerType } from "#convex/editor/lib/editorSessions";
import { fromConvexTuple } from "#convex/shared/lib/result";

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

type DeliverablesFolder = { id: string; url: string };

function returnNull(): null {
	return null;
}

function mapFolderAfterGuestReadLink(folder: DeliverablesFolder) {
	return folder;
}

function ensureAnyoneReaderPermissionForFolder(folderId: string, drive: DriveClient) {
	return ensureAnyoneReaderPermission(drive, folderId);
}

function grantGuestViewerLink(folder: DeliverablesFolder) {
	return loadDriveClient()
		.andThen((drive: DriveClient) => ensureAnyoneReaderPermissionForFolder(folder.id, drive))
		.map(() => mapFolderAfterGuestReadLink(folder));
}

function parseSavedDeliverablesFolderFromSetup(setupInfo: DriveSetupInfo | null) {
	const deliverablesFolder = setupInfo?.driveSession?.deliverablesFolder;

	if (deliverablesFolder === undefined) {
		return errAsync({ reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const });
	}

	return okAsync(deliverablesFolder);
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.driveInternal.getDriveSetup, { bookingId })
	).andThen(parseSavedDeliverablesFolderFromSetup);
}

function requireNonEmptyDeliverablesFolder(
	folder: DeliverablesFolder,
	children: ListedDriveChild[]
) {
	if (children.length === 0) {
		return errAsync({ reason: "DELIVERABLES_FOLDER_EMPTY" as const });
	}

	return okAsync(folder);
}

function listDeliverablesFolderChildren(folder: DeliverablesFolder, drive: DriveClient) {
	return listDriveFolderChildren(drive, folder.id);
}

function requireDeliverablesFolderContents(folder: DeliverablesFolder) {
	return loadDriveClient()
		.andThen((drive: DriveClient) => listDeliverablesFolderChildren(folder, drive))
		.andThen((children: ListedDriveChild[]) => requireNonEmptyDeliverablesFolder(folder, children));
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
): ResultAsync<DeliverablesFolder, SendDeliverablesError> {
	return requireSavedDeliverablesFolder(bookingId, ctx)
		.andThen(requireDeliverablesFolderContents)
		.andThen(grantGuestViewerLink);
}

function logDeliverablesEmailFailure(bookingId: Id<"bookings">, emailError: SendDeliverablesError) {
	console.error("Manual session deliverables email send failed", {
		bookingId,
		reason: emailError.reason
	});

	return emailError;
}

function sendDeliverablesEmailForSessionVariant(
	session: Doc<"bookings">,
	folderUrl: string,
	editorNotes: string | undefined,

	emailVariant: DeliverablesCustomerType
) {
	return sendDeliverablesEmail({
		date: session.date,
		driveLink: folderUrl,
		editorNotes,
		email: session.email,
		emailVariant,
		name: session.name
	});
}

export function sendDeliverablesEmailForSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	folderUrl: string,
	editorNotes: string | undefined
): ResultAsync<null, SendDeliverablesError> {
	return fromConvexTuple<Promise<ConvexResult<DeliverablesCustomerType, SendDeliverablesError>>>(
		ctx.runQuery(internal.sessions.admin.detectDeliverablesCustomerType, { bookingId: session._id })
	)
		.andThen((emailVariant: DeliverablesCustomerType) =>
			sendDeliverablesEmailForSessionVariant(session, folderUrl, editorNotes, emailVariant)
		)
		.map(returnNull)
		.mapErr((emailError) => logDeliverablesEmailFailure(session._id, emailError));
}
