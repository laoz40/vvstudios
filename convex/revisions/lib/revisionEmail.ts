"use node";

import { createElement } from "react";
import { render } from "@react-email/render";
import { err, ok, type Result, type ResultAsync } from "neverthrow";
import type { QuantityTrackedAddon } from "#/domain/booking/addon-quantities";
import {
	formatRevisionDeadline,
	getRevisionAddonRule,
	type RevisionFeedbackRowInput
} from "#/domain/revisions/rules";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { formatSessionDateLong } from "#convex/sessions/lib/calendarTime";
import { getHostEmails, sendEmail } from "#convex/shared/lib/email/emailSend";
import { logError } from "#convex/shared/lib/logger";
import { fromConvexTuple, tryPromise } from "#convex/shared/lib/result";
import { RevisionRequestedEmail } from "#studio/features/revision-requested-email/RevisionRequestedEmail";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface RevisionRequestedEmailData {
	roundId: Id<"revisionRounds">;
	roundNumber: number;
	dueAt: number;
	feedbackRows: RevisionFeedbackRowInput[];
	editLabel: string;
	editAddOn: QuantityTrackedAddon;
	clientName: string;
	accountName: string;
	sessionDate: string;
	sessionTime: string;
	sessionDuration: string;
	activeEditorEmail: string | null;
}

export function getRevisionEmailRecipients(
	roundId: Id<"revisionRounds">,
	activeEditorEmail: string | null
): Result<
	{ recipients: string[]; noActiveEditorAssigned: boolean },
	{ reason: "NO_NOTIFICATION_RECIPIENTS" }
> {
	if (activeEditorEmail !== null) {
		return ok({ recipients: [activeEditorEmail], noActiveEditorAssigned: false });
	}

	const studioEmails = getHostEmails();

	if (studioEmails.length === 0) {
		const failure = { reason: "NO_NOTIFICATION_RECIPIENTS" } as const;

		logError({
			...failure,
			operation: "email.getRevisionEmailRecipients",
			revisionRoundId: roundId
		});

		return err(failure);
	}

	return ok({ recipients: studioEmails, noActiveEditorAssigned: true });
}

export function buildRevisionRequestedSubject(emailData: RevisionRequestedEmailData) {
	const accountOrClient =
		emailData.accountName.trim().length > 0 &&
		emailData.accountName.trim() !== emailData.clientName.trim()
			? `${emailData.clientName} (${emailData.accountName})`
			: emailData.clientName;

	return `Revision requested: ${emailData.editLabel} - ${accountOrClient}`;
}

export function fetchRevisionRequestedEmailData(
	ctx: ActionCtx,
	revisionRoundId: Id<"revisionRounds">
): ResultAsync<RevisionRequestedEmailData, { reason: "REVISION_ROUND_NOT_FOUND" }> {
	return fromConvexTuple(
		ctx.runQuery(internal.revisions.notificationState.getRevisionRequestedEmailData, {
			revisionRoundId
		})
	);
}

export function runRecordRevisionNotificationStatus(
	ctx: ActionCtx,
	revisionRoundId: Id<"revisionRounds">,
	status: "sent" | "failed"
): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.revisions.notificationState.recordRevisionNotificationStatus, {
			revisionRoundId,
			status
		})
	);
}

export function renderRevisionRequestedEmailHtml(
	emailData: RevisionRequestedEmailData,
	noActiveEditorAssigned: boolean
) {
	const rule = getRevisionAddonRule(emailData.editAddOn);

	return tryPromise({
		try: () =>
			render(
				createElement(RevisionRequestedEmail, {
					clientName: emailData.clientName,
					sessionDateLabel: formatSessionDateLong(emailData.sessionDate),
					sessionTimeLabel: formatBookingTimeRange(
						emailData.sessionTime,
						emailData.sessionDuration
					),
					editLabel: emailData.editLabel,
					dueDateLabel: formatRevisionDeadline(emailData.dueAt),
					requiresClipNumber: rule.requiresClipNumber,
					feedbackRows: emailData.feedbackRows,
					noActiveEditorAssigned
				})
			),
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderRevisionRequested",
					revisionRoundId: emailData.roundId
				},
				cause
			);

			return failure;
		}
	});
}

export function sendRevisionRequestedEmailWithHtml(
	emailData: RevisionRequestedEmailData,
	recipients: string[],
	html: string
) {
	return sendEmail({
		to: recipients,
		subject: buildRevisionRequestedSubject(emailData),
		html,
		idempotencyKey: `revision-requested:${emailData.roundId}`,
		logContext: { operation: "email.sendRevisionRequested", revisionRoundId: emailData.roundId }
	});
}
