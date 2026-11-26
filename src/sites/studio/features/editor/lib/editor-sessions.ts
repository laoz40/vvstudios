import type { FunctionReturnType } from "convex/server";
import { EDIT_WORK_STATUSES } from "#/domain/booking/edit-status";
import { api } from "#convex/_generated/api";
import {
	getBookingDayDifference,
	getBookingStartTimestamp,
	getEditorEditDueAt
} from "#studio/lib/bookingdatetime";

export type EditorSession = FunctionReturnType<
	typeof api.sessions.admin.listEditorSessions
>["page"][number];

export type Edit = NonNullable<EditorSession["edits"]>[number];

export function getEditStatusActions({
	status,
	canManageEdits,
	canSendToClient
}: {
	status: Edit["status"];
	canManageEdits: boolean;
	canSendToClient: boolean | undefined;
}) {
	const stepIndex = EDIT_WORK_STATUSES.findIndex((step) => step === status);

	const canChangeStatus = canManageEdits && stepIndex >= 0;

	const canSend =
		canManageEdits && (status === "uploading" || (status === "review" && canSendToClient));

	return {
		nextStatus: canChangeStatus ? EDIT_WORK_STATUSES.at(stepIndex + 1) : undefined,
		undoStatus: canChangeStatus && stepIndex > 0 ? EDIT_WORK_STATUSES.at(stepIndex - 1) : undefined,
		sendToClient: canSend ? canSendToClient : undefined
	};
}

export function getEditorSessionDue(session: EditorSession, now = new Date()) {
	const startAt = getBookingStartTimestamp(session.date, session.time);
	const dueAt = getEditorEditDueAt(startAt, session.editorDueDate);
	const editsDue = session.edits?.filter((edit) => edit.status !== "sent").length;
	const sessionDay = getBookingDayDifference(session.date, now);

	const showDue =
		editsDue !== undefined
			? editsDue > 0
			: sessionDay !== null &&
				sessionDay < 0 &&
				(session.editStatus !== "review" || dueAt > now.getTime());

	return { dueAt, editsDue, showDue };
}
