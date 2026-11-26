import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { TableCell, TableHead, TableRow } from "#/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import type { EditWorkStatus } from "#/domain/booking/edit-status";
import { hasPermission } from "#/lib/permissions";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import { SessionEditsTableLayout } from "#studio/features/sessions/components/SessionEditsTableLayout";
import { EditStatusBadge } from "#studio/features/sessions/components/EditStatusBadge";
import { editStatuses } from "#studio/features/sessions/lib/edit-status-display";
import { EditorSendForReviewDialog } from "#studio/features/editor/components/EditorSendForReviewDialog";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
import {
	getEditStatusActions,
	type Edit,
	type EditorSession
} from "#studio/features/editor/lib/editor-sessions";
import {
	formatEditorEditDueDateTime,
	formatEditorEditDueDateTimeSydney,
	formatEditorEditDueLabel,
	getEditorEditDueSubtitleClassName
} from "#studio/lib/bookingdatetime";

type EditAction =
	| { kind: "idle" }
	| { kind: "updating" }
	| { kind: "confirming" | "sending"; toClient: boolean };

function EditStatusControl({
	session,
	edit,
	canManageEdits,
	canSendToClient,
	onDownloadingStarted
}: {
	session: EditorSession;
	edit: Edit;
	canManageEdits: boolean;
	canSendToClient: boolean | undefined;
	onDownloadingStarted: () => void;
}) {
	const updateEditStatus = useMutation(api.editor.editStatus.updateEditStatus);
	const sendEditToClient = useAction(api.editor.deliverablesEmail.sendEditToClient);
	const sendEditForStudioReview = useAction(api.editor.deliverablesEmail.sendEditForStudioReview);
	const [action, setAction] = useState<EditAction>({ kind: "idle" });

	const { nextStatus, undoStatus, sendToClient } = getEditStatusActions({
		status: edit.status,
		canManageEdits,
		canSendToClient
	});

	const sendLabel = sendToClient ? "Send to client" : "Send for review";

	const nextLabel =
		nextStatus === undefined ? sendLabel : `Set to ${editStatuses[nextStatus].label}`;

	const confirmation = "toClient" in action ? action : null;

	const args = { bookingId: session._id, editId: edit._id };

	async function updateStatus(status: EditWorkStatus) {
		setAction({ kind: "updating" });
		const [error] = await tryCatch(updateEditStatus({ ...args, status }));
		setAction({ kind: "idle" });

		if (error !== null) {
			toast.error("Unable to update this edit's status. Refresh and try again.");

			return;
		}

		if (status === "downloading" && edit.status === "not_started") onDownloadingStarted();
	}

	async function sendEdit(toClient: boolean, notes: string) {
		setAction({ kind: "sending", toClient });
		const send = toClient ? sendEditToClient : sendEditForStudioReview;
		const [error] = await tryCatch(send({ ...args, notes: notes.trim() || undefined }));

		if (error !== null) {
			setAction({ kind: "confirming", toClient });
			toast.error(deliverablesEmailErrorToast(error.reason));

			return;
		}

		setAction({ kind: "idle" });
		toast.success(
			toClient ? `${edit.label} sent to ${session.name}.` : `${edit.label} sent for review.`
		);
	}

	return (
		<div className="flex items-center gap-1">
			{undoStatus === undefined ? (
				<span
					aria-hidden
					className="size-6 shrink-0"
				/>
			) : (
				<Button
					type="button"
					variant="outline"
					size="icon-xs"
					aria-label={`Back to ${editStatuses[undoStatus].label} for ${edit.label}`}
					title={`Back to ${editStatuses[undoStatus].label}`}
					disabled={action.kind !== "idle"}
					onClick={() => void updateStatus(undoStatus)}>
					<ArrowLeft aria-hidden />
				</Button>
			)}
			<EditStatusBadge
				status={edit.status}
				isUpdating={action.kind === "updating"}
			/>
			{nextStatus !== undefined || sendToClient !== undefined ? (
				<Button
					type="button"
					variant="outline"
					size="icon-xs"
					aria-label={`${nextLabel} for ${edit.label}`}
					title={nextLabel}
					disabled={action.kind !== "idle"}
					onClick={() => {
						if (nextStatus !== undefined) {
							void updateStatus(nextStatus);
						} else if (sendToClient !== undefined) {
							setAction({ kind: "confirming", toClient: sendToClient });
						}
					}}>
					<ArrowRight aria-hidden />
				</Button>
			) : null}
			{confirmation !== null ? (
				<EditorSendForReviewDialog
					session={session}
					editLabel={edit.label}
					canSendToClient={confirmation.toClient}
					isSending={confirmation.kind === "sending"}
					open
					onOpenChange={(open) => {
						if (!open) setAction({ kind: "idle" });
					}}
					onSend={(notes) => void sendEdit(confirmation.toClient, notes)}
				/>
			) : null}
		</div>
	);
}

export function SessionEditsTable({
	session,
	edits,
	dueAt,
	view,
	canManageEdits,
	onDownloadingStarted
}: {
	session: EditorSession;
	edits: Edit[];
	dueAt: number;
	view: "edits" | "history";
	canManageEdits: boolean;
	onDownloadingStarted: () => void;
}) {
	const accessResult = useQuery(api.shared.auth.getCurrentUserAccess, {});
	const access = accessResult?.[1];

	const canSendToClient = access
		? session.editDeliveryMode !== "studio_review_only" &&
			hasPermission(access.permissions, "send:deliverables-email")
		: undefined;

	const dueDate = formatEditorEditDueDateTime(dueAt);
	const dueDateSydney = formatEditorEditDueDateTimeSydney(dueAt);
	const dueLabel = formatEditorEditDueLabel(dueAt);
	const dueSubtitleClassName = getEditorEditDueSubtitleClassName(dueAt, view);

	return (
		<SessionEditsTableLayout
			sessionName={session.name}
			afterDue={
				<>
					<TableHead>Feedback</TableHead>
					<TableHead>Notes</TableHead>
				</>
			}>
			{edits.map((edit) => (
				<TableRow key={edit._id}>
					<TableCell>
						<EditStatusControl
							session={session}
							edit={edit}
							canManageEdits={canManageEdits}
							canSendToClient={canSendToClient}
							onDownloadingStarted={onDownloadingStarted}
						/>
					</TableCell>
					<TableCell className="font-medium whitespace-normal">{edit.label}</TableCell>
					<TableCell>
						{edit.status === "sent" ? (
							<span className="text-muted-foreground">-</span>
						) : (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex w-fit cursor-pointer flex-col gap-1">
										<p className="font-medium">{dueDate}</p>
										<p className={cn("text-sm", dueSubtitleClassName)}>{dueLabel}</p>
									</div>
								</TooltipTrigger>
								<TooltipContent>{dueDateSydney}</TooltipContent>
							</Tooltip>
						)}
					</TableCell>
					<TableCell className="text-muted-foreground">-</TableCell>
					<TableCell className="text-muted-foreground">-</TableCell>
				</TableRow>
			))}
		</SessionEditsTableLayout>
	);
}
