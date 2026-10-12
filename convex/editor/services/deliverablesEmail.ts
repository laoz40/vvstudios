"use node";

import type { SendDeliverablesError as LibSendDeliverablesError } from "#convex/editor/lib/deliverablesEmailSteps";

import {
	queryDeliverablesSetup,
	queryDeliverablesCustomerType
} from "#convex/editor/lib/deliverablesEmailSteps";

import { ok, okAsync, safeTry } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/email/services/templateEmails";
import { loadDriveClient } from "#convex/drive/lib/googleDrive";
import { listDriveFolderChildren } from "#convex/drive/services/googleDriveOperations";
import { ensureAnyoneReaderPermission } from "#convex/drive/services/googleDrivePermissions";

import {
	parseSavedDeliverablesFolderFromSetup,
	requireNonEmptyDeliverablesFolder,
	logDeliverablesEmailFailure
} from "#convex/editor/lib/deliverablesEmailSteps";

export type SendSessionDeliverablesEmailArgs = { bookingId: Id<"bookings">; editorNotes?: string };

export type SendDeliverablesError = LibSendDeliverablesError;

type DeliverablesFolder = { id: string; url: string };

function grantGuestViewerLink(folder: DeliverablesFolder) {
	return safeTry(async function* () {
		const drive = yield* loadDriveClient();
		yield* ensureAnyoneReaderPermission(drive, folder.id);

		return ok(folder);
	});
}

function requireSavedDeliverablesFolder(bookingId: Id<"bookings">, ctx: ActionCtx) {
	return safeTry(async function* () {
		const setup = yield* queryDeliverablesSetup(ctx, bookingId);
		const folder = yield* parseSavedDeliverablesFolderFromSetup(setup);

		return ok(folder);
	});
}

function requireDeliverablesFolderContents(folder: DeliverablesFolder) {
	return safeTry(async function* () {
		const drive = yield* loadDriveClient();
		const children = yield* listDriveFolderChildren(drive, folder.id);
		const populatedFolder = yield* requireNonEmptyDeliverablesFolder(folder, children);

		return ok(populatedFolder);
	});
}

export function skipWhenDeliverablesEditAlreadyCompleted(session: Doc<"bookings">) {
	return okAsync(session.editStatus === "completed" ? null : session);
}

export function loadDeliverablesFolderGuestReadLink(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const folder = yield* requireSavedDeliverablesFolder(bookingId, ctx);
		const populatedFolder = yield* requireDeliverablesFolderContents(folder);

		return ok(yield* grantGuestViewerLink(populatedFolder));
	});
}

export function sendDeliverablesEmailForSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	folderUrl: string,
	editorNotes: string | undefined
) {
	return safeTry(async function* () {
		const emailVariant = yield* queryDeliverablesCustomerType(ctx, session);
		yield* sendDeliverablesEmail({
			date: session.date,
			driveLink: folderUrl,
			editorNotes,
			email: session.email,
			emailVariant,
			name: session.name
		});

		return ok(null);
	}).mapErr((emailError) => logDeliverablesEmailFailure(session._id, emailError));
}
