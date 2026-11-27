import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import {
	formatEditingAddonItemLabel,
	getEditingAddonQuantity
} from "#/domain/booking/addon-quantities";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";
import {
	getEditRevisionState,
	getRevisionAddonRule,
	getRevisionWindowEndsAt,
	isEditRevisionEligible,
	validateRevisionFeedbackRows,
	type RevisionFeedbackRowInput
} from "#/domain/revisions/rules";
import { exhaustiveCheck } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export type SubmitFreeRevisionError =
	| { reason: "EDIT_NOT_FOUND" }
	| { reason: "EDIT_NOT_DELIVERED" }
	| { reason: "REVISION_WINDOW_CLOSED" }
	| { reason: "NO_FREE_REVISIONS_LEFT" }
	| { reason: "INVALID_FEEDBACK_ROWS" };

export function listEditRevisionRounds(ctx: QueryCtx, editId: Id<"edits">) {
	return okOrThrow(
		ctx.db
			.query("revisionRounds")
			.withIndex("by_editId", (q) => q.eq("editId", editId))
			.collect()
	);
}

export function loadRevisionRound(ctx: QueryCtx, revisionRoundId: Id<"revisionRounds">) {
	return okOrThrow(ctx.db.get("revisionRounds", revisionRoundId));
}

export function requireSubmittableFreeRevisionEdit(input: {
	session: Doc<"bookings">;
	edit: Doc<"edits">;
	rounds: ReadonlyArray<Doc<"revisionRounds">>;
	now: number;
}): Result<{ nextRoundNumber: number; dueAt: number }, SubmitFreeRevisionError> {
	if (!isEditRevisionEligible(input.session, input.edit)) {
		return err({ reason: "EDIT_NOT_FOUND" });
	}

	let freeRoundsUsed = 0;
	let paidRoundsUsed = 0;
	let highestRoundNumber = 0;

	for (const round of input.rounds) {
		if (round.roundNumber > highestRoundNumber) {
			highestRoundNumber = round.roundNumber;
		}

		if (round.status === "awaiting_payment") continue;

		if (round.billingKind === "free") {
			freeRoundsUsed += 1;
		} else {
			paidRoundsUsed += 1;
		}
	}

	const revisionState = getEditRevisionState({
		addOn: input.edit.addOn,
		deliveredAt: input.edit.deliveredAt,
		revisionWindowEndsAt: input.edit.revisionWindowEndsAt,
		freeRoundsUsed,
		paidRoundsUsed,
		now: input.now
	});

	const { state } = revisionState;

	switch (state.kind) {
		case "not_delivered":
			return err({ reason: "EDIT_NOT_DELIVERED" });
		case "open_paid":
			return err({ reason: "NO_FREE_REVISIONS_LEFT" });
		case "closed":
			return err({
				reason:
					state.closedReason === "allowance_exhausted"
						? "NO_FREE_REVISIONS_LEFT"
						: "REVISION_WINDOW_CLOSED"
			});
		case "open_free":
			return ok({
				nextRoundNumber: highestRoundNumber + 1,
				dueAt: getRevisionWindowEndsAt(input.now)
			});
		default:
			return exhaustiveCheck(state);
	}
}

export function validateSubmittedFeedbackRows(
	edit: Doc<"edits">,
	feedbackRows: ReadonlyArray<RevisionFeedbackRowInput>
): Result<RevisionFeedbackRowInput[], { reason: "INVALID_FEEDBACK_ROWS" }> {
	const rule = getRevisionAddonRule(edit.addOn);
	const validation = validateRevisionFeedbackRows(feedbackRows, rule.requiresClipNumber);

	if (!validation.ok) {
		return err({ reason: "INVALID_FEEDBACK_ROWS" });
	}

	return ok(validation.rows);
}

export function insertFreeRevisionRound(
	ctx: MutationCtx,
	record: {
		bookingId: Id<"bookings">;
		editId: Id<"edits">;
		roundNumber: number;
		feedbackRows: RevisionFeedbackRowInput[];
		requestedAt: number;
		dueAt: number;
	}
) {
	return okOrThrow(
		ctx.db.insert("revisionRounds", {
			bookingId: record.bookingId,
			editId: record.editId,
			roundNumber: record.roundNumber,
			billingKind: "free",
			status: "requested",
			feedbackRows: record.feedbackRows,
			requestedAt: record.requestedAt,
			dueAt: record.dueAt
		})
	);
}

export function markEditRevisionRequested(ctx: MutationCtx, editId: Id<"edits">) {
	return okOrThrow(ctx.db.patch("edits", editId, { status: "revision_requested" }));
}

export function scheduleRevisionRequestedEmailJob(
	ctx: MutationCtx,
	revisionRoundId: Id<"revisionRounds">
): ResultAsync<Id<"_scheduled_functions">, never> {
	return okOrThrow(
		ctx.scheduler.runAfter(0, internal.revisions.notifications.sendRevisionRequestedEmail, {
			revisionRoundId
		})
	);
}

export function patchRevisionNotificationStatus(
	ctx: MutationCtx,
	revisionRoundId: Id<"revisionRounds">,
	status: "sent" | "failed"
) {
	return okOrThrow(
		ctx.db.patch("revisionRounds", revisionRoundId, { notificationEmailStatus: status })
	);
}

export function requireRevisionRound(
	round: Doc<"revisionRounds"> | null
): Result<Doc<"revisionRounds">, { reason: "REVISION_ROUND_NOT_FOUND" }> {
	if (round === null) {
		return err({ reason: "REVISION_ROUND_NOT_FOUND" });
	}

	return ok(round);
}

export function loadOptionalEditorByToken(ctx: QueryCtx, tokenIdentifier: string | undefined) {
	if (tokenIdentifier === undefined) {
		return okAsync<Doc<"editorProfiles"> | null>(null);
	}

	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
			.unique()
	);
}

export function buildRevisionRequestedEmailData(input: {
	round: Doc<"revisionRounds">;
	session: Doc<"bookings"> | null;
	edit: Doc<"edits"> | null;
	assignedEditor: Doc<"editorProfiles"> | null;
}) {
	if (input.session === null || input.edit === null) {
		return err({ reason: "REVISION_ROUND_NOT_FOUND" as const });
	}

	const trimmedEmail = input.assignedEditor?.email.trim() ?? "";

	const activeEditorEmail =
		input.assignedEditor !== null && input.assignedEditor.isActive && trimmedEmail.length > 0
			? trimmedEmail
			: null;

	const addOnDisplayName = getCustomerAddonDisplayLabel(input.edit.addOn);
	const addOnQuantity = getEditingAddonQuantity(input.edit.addOn, input.session, 1);

	const editLabel =
		addOnQuantity > 1
			? `${addOnDisplayName} (${formatEditingAddonItemLabel(input.edit.addOn, input.edit.addOnItemNumber)})`
			: addOnDisplayName;

	return ok({
		roundId: input.round._id,
		roundNumber: input.round.roundNumber,
		dueAt: input.round.dueAt ?? input.round.requestedAt,
		feedbackRows: input.round.feedbackRows,
		editLabel,
		editAddOn: input.edit.addOn,
		clientName: input.session.name,
		accountName: input.session.accountName,
		sessionDate: input.session.date,
		sessionTime: input.session.time,
		sessionDuration: input.session.duration,
		activeEditorEmail
	});
}
