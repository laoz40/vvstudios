import type { UserIdentity } from "convex/server";
import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getEditorByToken, isAdminIdentity } from "#convex/shared/lib/auth";
import { okOrThrow } from "#convex/shared/lib/result";

type EditStatus = NonNullable<Doc<"bookings">["editStatus"]>;

function buildDeliverablesReviewHostEmailArgs(
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | null,
	identity: UserIdentity
) {
	const editorName = editor?.displayName ?? identity.name ?? "An editor";

	return {
		bookingId: session._id,
		clientName: session.name,
		editorName,
		sessionDate: session.date,
		idempotencyKey: `deliverables-review:${session._id}:${Date.now()}`
	};
}

export function loadDeliverablesReviewHostEmailArgs(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	identity: UserIdentity,
	editStatus: EditStatus
) {
	if (editStatus !== "review" || session.editStatus === "review" || isAdminIdentity(identity)) {
		return okAsync(null);
	}

	return getEditorByToken(ctx, identity.tokenIdentifier).map((editor) =>
		editor?.canSendDeliverables
			? null
			: buildDeliverablesReviewHostEmailArgs(session, editor, identity)
	);
}

export function scheduleDeliverablesReviewHostEmail(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		deliverablesFolderUrl?: string;
		clientName: string;
		editorName: string;
		idempotencyKey: string;
		sessionDate: string;
	} | null
): ResultAsync<null, never> {
	if (args === null) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.editor.deliverablesReviewEmail.sendDeliverablesReviewReadyEmail, args)
			.then(() => null)
	);
}
