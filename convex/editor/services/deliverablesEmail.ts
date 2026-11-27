"use node";

import { ok, safeTry, type Result } from "neverthrow";

import type { QuantityTrackedAddon } from "#/domain/booking/addon-quantities";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendSessionDeliverablesEmail as sendDeliverablesEmail } from "#convex/email/services/templateEmails";
import { loadDriveClient } from "#convex/drive/lib/googleDrive";
import { listDriveFolderChildren } from "#convex/drive/services/googleDriveOperations";
import { grantAnyoneReaderPermission } from "#convex/drive/services/googleDrivePermissions";
import { buildDeliverablesRevisionInfo } from "#convex/revisions/lib/feedbackLinks";

import {
	parseSavedDeliverablesFolderFromSetup,
	queryDeliverablesSetup,
	queryDeliverablesCustomerType,
	requireNonEmptyDeliverablesFolder,
	requestDeliverablesEmailLock,
	submitDeliverablesEmailResult,
	type DeliverablesEmailLock,
	type SendDeliverablesError as LibSendDeliverablesError
} from "#convex/editor/lib/deliverablesEmailSteps";
import { buildDeliverablesEmailOutcome } from "#convex/editor/lib/editDelivery";

export type SendDeliverablesError = LibSendDeliverablesError;

export function loadDeliverablesFolderWithFiles(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const setup = yield* queryDeliverablesSetup(ctx, bookingId);
		const folder = yield* parseSavedDeliverablesFolderFromSetup(setup);
		const drive = yield* loadDriveClient();
		const children = yield* listDriveFolderChildren(drive, folder.id);

		return ok(yield* requireNonEmptyDeliverablesFolder(folder, children));
	});
}

export function sendClientDeliverablesEmail(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	editorNotes: string | undefined,
	edit?: {
		addOn: QuantityTrackedAddon;
		feedbackToken?: string;
		label: string;
		idempotencyKey: string;
	}
) {
	return safeTry(async function* () {
		const folder = yield* loadDeliverablesFolderWithFiles(ctx, session._id);
		const drive = yield* loadDriveClient();
		yield* grantAnyoneReaderPermission(drive, folder.id);

		const emailVariant = yield* queryDeliverablesCustomerType(ctx, session);

		yield* sendDeliverablesEmail({
			bookingId: session._id,
			date: session.date,
			driveLink: folder.url,
			editLabel: edit?.label,
			editorNotes,
			email: session.email,
			emailVariant,
			idempotencyKey: edit?.idempotencyKey,
			name: session.name,
			revisionInfo: buildDeliverablesRevisionInfo(edit)
		});

		return ok(null);
	});
}

export function lockEditForEmail(
	ctx: ActionCtx,
	edit: Pick<DeliverablesEmailLock, "bookingId" | "editId">,
	recipient: DeliverablesEmailLock["recipient"]
) {
	const lock = { ...edit, recipient, lockId: crypto.randomUUID() };

	// Preserve the provider keys used by any earlier attempt.
	const idempotencyKey =
		recipient === "client"
			? `initial-edit:client:${edit.editId}`
			: `initial-edit:studio:${edit.editId}`;

	return requestDeliverablesEmailLock(ctx, lock).map((delivery) => ({
		...delivery,
		lock,
		// A retry uses the same key until the next successful delivery is recorded.
		idempotencyKey:
			delivery.previousDeliveryAt === undefined
				? idempotencyKey
				: `${idempotencyKey}:${delivery.previousDeliveryAt}`
	}));
}

export function recordDeliverablesEmailResult(
	ctx: ActionCtx,
	lock: DeliverablesEmailLock,
	sendResult: Result<null, SendDeliverablesError>,
	feedbackToken?: string
) {
	return submitDeliverablesEmailResult(
		ctx,
		lock,
		buildDeliverablesEmailOutcome(sendResult, feedbackToken)
	);
}
