import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getEditorByToken } from "#convex/lib/auth";
import {
	scheduleDeliverablesReviewHostEmail,
	shouldNotifyHostOfDeliverablesReview
} from "#convex/lib/editor/deliverablesReviewNotification";
import { saveSessionEditStatus } from "#convex/lib/editor/editorSessions";
import { archiveSessionWhenFullyDone } from "#convex/lib/sessions/sessionArchive";

type DeliverablesEditAccess = { identity: UserIdentity; session: Doc<"bookings"> };

export function writeSessionEditStatusWithHostNotification(
	ctx: MutationCtx,
	access: DeliverablesEditAccess,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	const { identity, session } = access;

	const shouldNotifyHost = shouldNotifyHostOfDeliverablesReview({
		identity,
		previousEditStatus: session.editStatus,
		nextEditStatus: editStatus
	});

	return saveSessionEditStatus(ctx, session, editStatus).andThen(() => {
		if (!shouldNotifyHost) {
			return archiveSessionWhenFullyDone(ctx, session._id);
		}

		return getEditorByToken(ctx, identity.tokenIdentifier)
			.andThen((editor) => {
				const editorName = editor?.displayName ?? identity.name ?? "An editor";

				return scheduleDeliverablesReviewHostEmail(ctx, {
					bookingId: session._id,
					clientName: session.name,
					editorName,
					sessionDate: session.date,
					idempotencyKey: `deliverables-review:${session._id}:${Date.now()}`
				});
			})
			.andThen(() => archiveSessionWhenFullyDone(ctx, session._id));
	});
}
