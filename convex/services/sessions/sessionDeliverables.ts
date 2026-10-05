import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getEditorByToken } from "#convex/lib/auth";
import {
	scheduleDeliverablesReviewHostEmail,
	shouldNotifyHostOfDeliverablesReview
} from "#convex/lib/editor/deliverablesReviewNotification";
import { saveSessionEditStatus } from "#convex/services/editor/sessionEditStatus";
import { archiveSessionWhenFullyDone } from "#convex/services/sessions/sessionArchive";

type DeliverablesEditAccess = { identity: UserIdentity; session: Doc<"bookings"> };

function archiveAfterDeliverablesEditStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return archiveSessionWhenFullyDone(ctx, bookingId);
}

function scheduleHostReviewEmailStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	identity: UserIdentity,

	editor: Doc<"editorProfiles"> | null
) {
	const editorName = editor?.displayName ?? identity.name ?? "An editor";

	return scheduleDeliverablesReviewHostEmail(ctx, {
		bookingId: session._id,
		clientName: session.name,
		editorName,
		sessionDate: session.date,
		idempotencyKey: `deliverables-review:${session._id}:${Date.now()}`
	});
}

function notifyHostThenArchiveStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	identity: UserIdentity
) {
	return getEditorByToken(ctx, identity.tokenIdentifier)
		.andThen((editor: Doc<"editorProfiles"> | null) =>
			scheduleHostReviewEmailStep(ctx, session, identity, editor)
		)
		.andThen(() => archiveAfterDeliverablesEditStep(ctx, session._id));
}

function afterEditStatusSavedStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	shouldNotifyHost: boolean,
	identity: UserIdentity
) {
	if (!shouldNotifyHost) {
		return archiveSessionWhenFullyDone(ctx, session._id);
	}

	return notifyHostThenArchiveStep(ctx, session, identity);
}

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

	return saveSessionEditStatus(ctx, session, editStatus).andThen(() =>
		afterEditStatusSavedStep(ctx, session, shouldNotifyHost, identity)
	);
}
