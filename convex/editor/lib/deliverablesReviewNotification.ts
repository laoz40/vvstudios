import type { UserIdentity } from "convex/server";
import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getEditorByToken, isAdminIdentity } from "#convex/shared/lib/auth";
import { okOrThrow } from "#convex/shared/lib/result";

type EditStatus = NonNullable<Doc<"bookings">["editStatus"]>;

export function shouldNotifyHostOfDeliverablesReview(args: {
	identity: UserIdentity;
	previousEditStatus: EditStatus | undefined;
	nextEditStatus: EditStatus;
}) {
	return (
		args.nextEditStatus === "review" &&
		args.previousEditStatus !== "review" &&
		!isAdminIdentity(args.identity)
	);
}

export function shouldNotifyHostOfSessionEditStatus(
	identity: UserIdentity,
	previousEditStatus: EditStatus | undefined,
	nextEditStatus: EditStatus
) {
	return shouldNotifyHostOfDeliverablesReview({ identity, previousEditStatus, nextEditStatus });
}

export function buildDeliverablesReviewHostEmailArgs(
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
	if (!shouldNotifyHostOfSessionEditStatus(identity, session.editStatus, editStatus)) {
		return okAsync(null);
	}

	return getEditorByToken(ctx, identity.tokenIdentifier).map((editor) =>
		buildDeliverablesReviewHostEmailArgs(session, editor, identity)
	);
}

export function scheduleDeliverablesReviewHostEmail(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
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
