import { errAsync, okAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { internal } from "#convex/_generated/api";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { DeliverablesCustomerType } from "#convex/editor/lib/editorSessions";
import type { Result as ConvexResult } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { DriveError, ListedDriveChild } from "#convex/drive/lib/googleDrive";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";

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

export function parseSavedDeliverablesFolderFromSetup(setupInfo: DriveSetupInfo | null) {
	const deliverablesFolder = setupInfo?.driveSession?.deliverablesFolder;

	if (deliverablesFolder === undefined) {
		return errAsync({ reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const });
	}

	return okAsync(deliverablesFolder);
}

export function requireNonEmptyDeliverablesFolder(
	folder: DeliverablesFolder,
	children: ListedDriveChild[]
) {
	if (children.length === 0) {
		return errAsync({ reason: "DELIVERABLES_FOLDER_EMPTY" as const });
	}

	return okAsync(folder);
}

export function logDeliverablesEmailFailure(
	bookingId: Id<"bookings">,
	emailError: SendDeliverablesError
) {
	console.error("Manual session deliverables email send failed", {
		bookingId,
		reason: emailError.reason
	});

	return emailError;
}

export function queryDeliverablesSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId }));
}

export function queryDeliverablesCustomerType(ctx: ActionCtx, session: Doc<"bookings">) {
	return fromConvexTuple<Promise<ConvexResult<DeliverablesCustomerType, SendDeliverablesError>>>(
		ctx.runQuery(internal.sessions.admin.detectDeliverablesCustomerType, { bookingId: session._id })
	);
}
