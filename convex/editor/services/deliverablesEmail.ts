"use node";

import type { SendDeliverablesError as LibSendDeliverablesError } from "#convex/editor/lib/deliverablesEmailSteps";

import {
	queryDeliverablesSetup,
	queryDeliverablesCustomerType
} from "#convex/editor/lib/deliverablesEmailSteps";

import { okAsync, type ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/email/services/templateEmails";
import {
	loadDriveClient,
	type DriveClient,
	type ListedDriveChild
} from "#convex/drive/lib/googleDrive";
import { listDriveFolderChildren } from "#convex/drive/services/googleDriveOperations";
import { ensureAnyoneReaderPermission } from "#convex/drive/services/googleDrivePermissions";

import type { DeliverablesCustomerType } from "#convex/editor/lib/editorSessions";

import {
	parseSavedDeliverablesFolderFromSetup,
	requireNonEmptyDeliverablesFolder,
	logDeliverablesEmailFailure
} from "#convex/editor/lib/deliverablesEmailSteps";

export type SendSessionDeliverablesEmailArgs = { bookingId: Id<"bookings">; editorNotes?: string };

export type SendDeliverablesError = LibSendDeliverablesError;

type DeliverablesFolder = { id: string; url: string };

function grantGuestViewerLink(folder: DeliverablesFolder) {
	return loadDriveClient()
		.andThen((drive: DriveClient) => ensureAnyoneReaderPermission(drive, folder.id))
		.map(() => folder);
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return queryDeliverablesSetup(ctx, bookingId).andThen(parseSavedDeliverablesFolderFromSetup);
}

function requireDeliverablesFolderContents(folder: DeliverablesFolder) {
	return loadDriveClient()
		.andThen((drive: DriveClient) => listDriveFolderChildren(drive, folder.id))
		.andThen((children: ListedDriveChild[]) => requireNonEmptyDeliverablesFolder(folder, children));
}

export function skipWhenDeliverablesEditAlreadyCompleted(
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings"> | null, never> {
	return okAsync(session.editStatus === "completed" ? null : session);
}

export function loadDeliverablesFolderGuestReadLink(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<DeliverablesFolder, SendDeliverablesError> {
	return requireSavedDeliverablesFolder(bookingId, ctx)
		.andThen(requireDeliverablesFolderContents)
		.andThen(grantGuestViewerLink);
}

export function sendDeliverablesEmailForSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	folderUrl: string,
	editorNotes: string | undefined
): ResultAsync<null, SendDeliverablesError> {
	return queryDeliverablesCustomerType(ctx, session)
		.andThen((emailVariant: DeliverablesCustomerType) =>
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
		.mapErr((emailError) => logDeliverablesEmailFailure(session._id, emailError));
}
