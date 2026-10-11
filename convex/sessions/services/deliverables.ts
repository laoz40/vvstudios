import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	loadDeliverablesReviewHostEmailArgs,
	scheduleDeliverablesReviewHostEmail
} from "#convex/editor/lib/deliverablesReviewNotification";
import { saveSessionEditStatus } from "#convex/editor/services/sessionEditStatus";
import { archiveSessionWhenFullyDone } from "#convex/sessions/services/archive";

type DeliverablesEditAccess = { identity: UserIdentity; session: Doc<"bookings"> };

export function writeSessionEditStatusWithHostNotification(
	ctx: MutationCtx,
	access: DeliverablesEditAccess,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	const { identity, session } = access;

	return saveSessionEditStatus(ctx, session, editStatus)
		.andThen(() => loadDeliverablesReviewHostEmailArgs(ctx, session, identity, editStatus))
		.andThen((args) => scheduleDeliverablesReviewHostEmail(ctx, args))
		.andThen(() => archiveSessionWhenFullyDone(ctx, session._id));
}
