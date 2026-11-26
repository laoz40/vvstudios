import { err, ok, type Result } from "neverthrow";
import {
	QUANTITY_TRACKED_ADDONS,
	type QuantityTrackedAddon
} from "#/domain/booking/addon-quantities";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";
import {
	getEditRevisionState,
	getRevisionAddonRule,
	isEditPurchasedForSession,
	isSessionRevisionEligible,
	MAX_PAID_REVISION_ROUNDS,
	PAID_REVISION_PRICE_AUD
} from "#/domain/revisions/rules";
import type { Doc, Id } from "#convex/_generated/dataModel";

export type FeedbackSessionLookupError =
	| { reason: "FEEDBACK_LINK_INVALID" }
	| { reason: "REVISIONS_NOT_ELIGIBLE" };

export function validateFeedbackTokenInput(
	token: string
): Result<string, { reason: "FEEDBACK_LINK_INVALID" }> {
	const trimmed = token.trim();

	if (trimmed.length === 0) {
		return err({ reason: "FEEDBACK_LINK_INVALID" });
	}

	return ok(trimmed);
}

export function requireFeedbackLink(
	link: Doc<"sessionFeedbackLinks"> | null
): Result<Doc<"sessionFeedbackLinks">, { reason: "FEEDBACK_LINK_INVALID" }> {
	if (link === null) {
		return err({ reason: "FEEDBACK_LINK_INVALID" });
	}

	return ok(link);
}

export function requireEligibleFeedbackSession(
	session: Doc<"bookings"> | null
): Result<Doc<"bookings">, FeedbackSessionLookupError> {
	if (session === null) {
		return err({ reason: "FEEDBACK_LINK_INVALID" });
	}

	if (
		(session.status !== "confirmed" && session.status !== "email_failed") ||
		!isSessionRevisionEligible(session)
	) {
		return err({ reason: "REVISIONS_NOT_ELIGIBLE" });
	}

	return ok(session);
}

function countConsumedRoundsByEdit(rounds: ReadonlyArray<Doc<"revisionRounds">>) {
	const counts = new Map<Id<"edits">, { free: number; paid: number }>();

	for (const round of rounds) {
		if (round.status === "awaiting_payment") continue;

		const current = counts.get(round.editId) ?? { free: 0, paid: 0 };

		if (round.billingKind === "free") {
			current.free += 1;
		} else {
			current.paid += 1;
		}

		counts.set(round.editId, current);
	}

	return counts;
}

export function buildFeedbackSessionView(input: {
	session: Doc<"bookings">;
	edits: ReadonlyArray<Doc<"edits">>;
	rounds: ReadonlyArray<Doc<"revisionRounds">>;
	assetsFolderUrl: string | null;
	now: number;
}) {
	const countsByEdit = countConsumedRoundsByEdit(input.rounds);
	const editsByAddon = new Map<QuantityTrackedAddon, Doc<"edits">[]>();

	for (const edit of input.edits) {
		if (!isEditPurchasedForSession(input.session, edit)) {
			continue;
		}

		const list = editsByAddon.get(edit.addOn) ?? [];
		list.push(edit);
		editsByAddon.set(edit.addOn, list);
	}

	const groups = QUANTITY_TRACKED_ADDONS.flatMap((addOn) => {
		const groupEdits = editsByAddon
			.get(addOn)
			?.toSorted((a, b) => a.addOnItemNumber - b.addOnItemNumber);

		if (groupEdits === undefined || groupEdits.length === 0) {
			return [];
		}

		const rule = getRevisionAddonRule(addOn);
		const isRepeated = groupEdits.length > 1;

		return [
			{
				addOn,
				displayName: getCustomerAddonDisplayLabel(addOn),
				freeRoundsAllowed: rule.freeRounds,
				scope: rule.scope,
				scopeSummary: rule.scopeSummary,
				requiresClipNumber: rule.requiresClipNumber,
				edits: groupEdits.map((edit) => {
					const consumed = countsByEdit.get(edit._id) ?? { free: 0, paid: 0 };

					const revisionState = getEditRevisionState({
						addOn: edit.addOn,
						deliveredAt: edit.deliveredAt,
						revisionWindowEndsAt: edit.revisionWindowEndsAt,
						freeRoundsUsed: consumed.free,
						paidRoundsUsed: consumed.paid,
						now: input.now
					});

					return {
						_id: edit._id,
						addOn: edit.addOn,
						addOnItemNumber: edit.addOnItemNumber,
						label: edit.label,
						episodeLabel: isRepeated ? `Episode ${edit.addOnItemNumber}` : null,
						deliveredAt: edit.deliveredAt ?? null,
						freeRoundsUsed: consumed.free,
						freeRoundsRemaining: revisionState.freeRoundsRemaining,
						paidRoundsUsed: consumed.paid,
						paidRoundsRemaining: revisionState.paidRoundsRemaining,
						state: revisionState.state
					};
				})
			}
		];
	});

	return {
		session: {
			name: input.session.name,
			date: input.session.date,
			time: input.session.time,
			assetsFolderUrl: input.assetsFolderUrl
		},
		pricing: {
			paidRoundPriceAud: PAID_REVISION_PRICE_AUD,
			maxPaidRounds: MAX_PAID_REVISION_ROUNDS
		},
		groups
	};
}
