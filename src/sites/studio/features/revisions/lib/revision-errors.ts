import type { FunctionReturnType } from "convex/server";
import { formatRevisionShortDate } from "#/domain/revisions/rules";
import { exhaustiveCheck } from "#/lib/result";
import type { api } from "#convex/_generated/api";

type FeedbackSessionResult = FunctionReturnType<
	typeof api.revisions.public.getFeedbackSessionByToken
>;

export type FeedbackSessionData = NonNullable<FeedbackSessionResult[1]>;

export type FeedbackSessionError = NonNullable<FeedbackSessionResult[0]>;

type SubmitRevisionResult = FunctionReturnType<typeof api.revisions.public.submitFreeRevisionRound>;

export type SubmitRevisionError = NonNullable<SubmitRevisionResult[0]>;

export type RevisionEditCardItem = FeedbackSessionData["groups"][number]["edits"][number] & {
	displayName: string;
	freeRoundsAllowed: number;
	scope: FeedbackSessionData["groups"][number]["scope"];
	scopeSummary: string;
	requiresClipNumber: boolean;
};

export function flattenSessionEdits(groups: FeedbackSessionData["groups"]): RevisionEditCardItem[] {
	return groups.flatMap((group) =>
		group.edits.map((edit) => ({
			...edit,
			displayName: group.displayName,
			freeRoundsAllowed: group.freeRoundsAllowed,
			scope: group.scope,
			scopeSummary: group.scopeSummary,
			requiresClipNumber: group.requiresClipNumber
		}))
	);
}

export function formatEditCardTitle(edit: Pick<RevisionEditCardItem, "displayName" | "itemLabel">) {
	return edit.itemLabel !== null ? `${edit.displayName} - ${edit.itemLabel}` : edit.displayName;
}

export function formatClosedEditSummary(
	state: Extract<RevisionEditCardItem["state"], { kind: "closed" }>
) {
	const { closedReason } = state;

	switch (closedReason) {
		case "window_expired":
			return `Revision window closed ${formatRevisionShortDate(state.windowEndsAt)}`;
		case "allowance_exhausted":
			return "All revisions used";
		case "pre_rollout":
			return "Revisions are not available for this delivery";
		default:
			return exhaustiveCheck(closedReason);
	}
}

export function formatSubmittedRoundStatus(
	round: Pick<RevisionEditCardItem["submittedRounds"][number], "status" | "dueAt">
) {
	if (round.status === "delivered") {
		return "Delivered";
	}

	if (round.dueAt !== null) {
		return `Requested · Est. ready ${formatRevisionShortDate(round.dueAt)}`;
	}

	return "Requested";
}

export function formatNotesCount(count: number) {
	return count === 1 ? "1 note" : `${count} notes`;
}

export function getFeedbackLinkInvalidMessage(error: FeedbackSessionError) {
	switch (error.reason) {
		case "FEEDBACK_LINK_INVALID":
			return {
				title: "This revision link is not valid",
				description:
					"Please use the latest link from your deliverables email, or contact VV Studios if you need help."
			};
		case "REVISIONS_NOT_ELIGIBLE":
			return {
				title: "Revisions are not available for this session",
				description:
					"This session is not eligible for online revision requests. Please reply to your deliverables email if you need assistance."
			};
		default:
			return exhaustiveCheck(error);
	}
}

export function getSubmitRevisionErrorMessage(
	error: SubmitRevisionError | { reason: "UNEXPECTED_ERROR" }
): string {
	switch (error.reason) {
		case "FEEDBACK_LINK_INVALID":
		case "REVISIONS_NOT_ELIGIBLE":
			return "This revision link is no longer valid.";
		case "EDIT_NOT_FOUND":
			return "This edit could not be found for your session.";
		case "EDIT_NOT_DELIVERED":
			return "This edit has not been delivered yet.";
		case "REVISION_WINDOW_CLOSED":
			return "The revision window for this edit has closed. Refresh the page to see the latest status.";
		case "NO_FREE_REVISIONS_LEFT":
			return "You have used all free revisions for this edit.";
		case "INVALID_FEEDBACK_ROWS":
			return "Please check your timestamps, clip numbers, and notes before submitting.";
		case "UNEXPECTED_ERROR":
			return "Something went wrong while submitting your revision request. Please try again.";
		default:
			return exhaustiveCheck(error);
	}
}
