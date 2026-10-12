import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { ok, safeTry } from "neverthrow";
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

	return safeTry(async function* () {
		yield* saveSessionEditStatus(ctx, session, editStatus);

		const emailArgs = yield* loadDeliverablesReviewHostEmailArgs(
			ctx,
			session,
			identity,
			editStatus
		);

		yield* scheduleDeliverablesReviewHostEmail(ctx, emailArgs);
		const archivedSession = yield* archiveSessionWhenFullyDone(ctx, session._id);

		return ok(archivedSession);
	});
}
