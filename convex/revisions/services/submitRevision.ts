import { ok, ResultAsync, safeTry } from "neverthrow";
import type { RevisionFeedbackRowInput } from "#/domain/revisions/rules";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { loadBookingRow } from "#convex/drive/lib/driveBookingDriveClient";
import { loadEdit, requireSessionEdit } from "#convex/editor/lib/editDelivery";
import {
	buildRevisionRequestedEmailData,
	insertFreeRevisionRound,
	listEditRevisionRounds,
	loadOptionalEditorByToken,
	loadRevisionRound,
	markEditRevisionRequested,
	patchRevisionNotificationStatus,
	requireRevisionRound,
	requireSubmittableFreeRevisionEdit,
	scheduleRevisionRequestedEmailJob,
	validateSubmittedFeedbackRows
} from "#convex/revisions/lib/submitRevision";

export function validateFreeRevisionSubmission(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	args: { editId: Id<"edits">; feedbackRows: ReadonlyArray<RevisionFeedbackRowInput> },
	now: number
) {
	return safeTry(async function* () {
		const rawEdit = yield* loadEdit(ctx, args.editId);
		const edit = yield* requireSessionEdit(session, rawEdit);
		const rounds = yield* listEditRevisionRounds(ctx, edit._id);

		const { nextRoundNumber, dueAt } = yield* requireSubmittableFreeRevisionEdit({
			session,
			edit,
			rounds,
			now
		});

		const validatedRows = yield* validateSubmittedFeedbackRows(edit, args.feedbackRows);

		return ok({ edit, nextRoundNumber, dueAt, validatedRows });
	});
}

export function recordFreeRevisionSubmission(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	submission: {
		edit: Doc<"edits">;
		nextRoundNumber: number;
		dueAt: number;
		validatedRows: RevisionFeedbackRowInput[];
	},
	now: number
): ResultAsync<
	{ revisionRoundId: Id<"revisionRounds">; roundNumber: number; dueAt: number },
	never
> {
	return safeTry(async function* () {
		const revisionRoundId = yield* insertFreeRevisionRound(ctx, {
			bookingId: session._id,
			editId: submission.edit._id,
			roundNumber: submission.nextRoundNumber,
			feedbackRows: submission.validatedRows,
			requestedAt: now,
			dueAt: submission.dueAt
		});

		yield* markEditRevisionRequested(ctx, submission.edit._id);
		yield* scheduleRevisionRequestedEmailJob(ctx, revisionRoundId);

		return ok({
			revisionRoundId,
			roundNumber: submission.nextRoundNumber,
			dueAt: submission.dueAt
		});
	});
}

export function loadRevisionRequestedEmailData(
	ctx: QueryCtx,
	revisionRoundId: Id<"revisionRounds">
) {
	return safeTry(async function* () {
		const rawRound = yield* loadRevisionRound(ctx, revisionRoundId);
		const round = yield* requireRevisionRound(rawRound);

		const [session, edit] = yield* ResultAsync.combine([
			loadBookingRow(ctx, round.bookingId),
			loadEdit(ctx, round.editId)
		]);

		const assignedEditor = yield* loadOptionalEditorByToken(
			ctx,
			session?.assignedEditorTokenIdentifier
		);

		return ok(yield* buildRevisionRequestedEmailData({ round, session, edit, assignedEditor }));
	});
}

export function saveRevisionNotificationStatus(
	ctx: MutationCtx,
	revisionRoundId: Id<"revisionRounds">,
	status: "sent" | "failed"
) {
	return patchRevisionNotificationStatus(ctx, revisionRoundId, status);
}
