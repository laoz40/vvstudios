import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { ok, safeTry } from "neverthrow";
import {
	loadDeliverablesReviewHostEmailArgs,
	scheduleDeliverablesReviewHostEmail
} from "#convex/editor/lib/deliverablesReviewNotification";
import { loadDriveSessionRowByBookingId } from "#convex/drive/lib/driveBookingDriveClient";
import { saveSessionEditStatus } from "#convex/editor/services/sessionEditStatus";
import { archiveSessionWhenFullyDone } from "#convex/sessions/services/archive";

type DeliverablesEditAccess = { identity: UserIdentity; session: Doc<"bookings"> };

export function writeSessionEditStatusWithHostNotification(
	ctx: MutationCtx,
	access: DeliverablesEditAccess,
	editStatus: NonNullable<Doc<"bookings">["editStatus"]>,
	deliverablesClientNotes?: string
) {
	const { identity, session } = access;

	return safeTry(async function* () {
		yield* saveSessionEditStatus(ctx, session, editStatus, deliverablesClientNotes);

		const emailArgs = yield* loadDeliverablesReviewHostEmailArgs(
			ctx,
			session,
			identity,
			editStatus
		);

		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, emailArgs?.bookingId ?? null);

		yield* scheduleDeliverablesReviewHostEmail(
			ctx,
			emailArgs === null
				? null
				: { ...emailArgs, deliverablesFolderUrl: driveSession?.deliverablesFolder?.url }
		);
		const archivedSession = yield* archiveSessionWhenFullyDone(ctx, session._id);

		return ok(archivedSession);
	});
}
