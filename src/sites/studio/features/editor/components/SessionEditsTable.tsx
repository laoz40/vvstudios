import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
	ArrowLeft,
	ArrowRight,
	CircleCheck,
	CircleX,
	Download,
	LoaderCircle,
	Pencil,
	Send,
	Upload,
	type LucideIcon
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import type { EditWorkStatus } from "#/domain/booking/edit-status";
import { hasPermission } from "#/lib/permissions";
import { tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import { deliverableStatusBadgeClassNameMap } from "#studio/features/admin/lib/session-edit-status";
import { EditorSendForReviewDialog } from "#studio/features/editor/components/EditorSendForReviewDialog";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
import {
	getEditStatusActions,
	type Edit,
	type EditorSession
} from "#studio/features/editor/lib/editor-sessions";
import { formatShortMonthFullDate } from "#studio/lib/bookingdatetime";

const statuses = {
	not_started: {
		label: "Not started",
		className: "bg-destructive text-primary-foreground",
		icon: CircleX
	},
	downloading: {
		label: "Downloading",
		className: deliverableStatusBadgeClassNameMap.downloading,
		icon: Download
	},
	editing: {
		label: "Editing",
		className: deliverableStatusBadgeClassNameMap.editing,
		icon: Pencil
	},
	uploading: {
		label: "Uploading",
		className: deliverableStatusBadgeClassNameMap.uploading,
		icon: Upload
	},
	review: {
		label: "Studio review",
		className: deliverableStatusBadgeClassNameMap.review,
		icon: CircleCheck
	},
	sent: { label: "Sent", className: deliverableStatusBadgeClassNameMap.completed, icon: Send }
} satisfies Record<Edit["status"], { label: string; className: string; icon: LucideIcon }>;

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

	const { label, className, icon: StatusIcon } = statuses[edit.status];

	const { currentStep, totalSteps, nextStatus, undoStatus, sendToClient } = getEditStatusActions({
		status: edit.status,
		canManageEdits,
		canSendToClient
	});

	const sendLabel = sendToClient ? "Send to client" : "Send for review";
	const isUpdating = action.kind === "updating";
	const nextLabel = nextStatus === undefined ? sendLabel : `Set to ${statuses[nextStatus].label}`;
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
					aria-label={`Back to ${statuses[undoStatus].label} for ${edit.label}`}
					title={`Back to ${statuses[undoStatus].label}`}
					disabled={action.kind !== "idle"}
					onClick={() => void updateStatus(undoStatus)}>
					<ArrowLeft aria-hidden />
				</Button>
			)}
			<Badge className={cn(className, "px-1.5 text-sm leading-tight [&>svg]:size-4")}>
				{isUpdating ? (
					<>
						<LoaderCircle
							className="animate-spin"
							aria-hidden
						/>
						<span className="sr-only">Updating</span>
					</>
				) : (
					<StatusIcon aria-hidden />
				)}
				<span className="tabular-nums opacity-70">
					{currentStep}/{totalSteps}
				</span>
				{label}
			</Badge>
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
	canManageEdits,
	onDownloadingStarted
}: {
	session: EditorSession;
	edits: Edit[];
	dueAt: number;
	canManageEdits: boolean;
	onDownloadingStarted: () => void;
}) {
	const accessResult = useQuery(api.shared.auth.getCurrentUserAccess, {});
	const access = accessResult?.[1];

	const canSendToClient = access
		? session.editDeliveryMode !== "studio_review_only" &&
			hasPermission(access.permissions, "send:deliverables-email")
		: undefined;

	const dueDate = formatShortMonthFullDate(dueAt);

	return (
		<Table className="table-fixed">
			<TableCaption className="sr-only">Edits for {session.name}</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead className="w-56">Status</TableHead>
					<TableHead className="w-64">Edit</TableHead>
					<TableHead className="w-32">Due</TableHead>
					<TableHead>Feedback</TableHead>
					<TableHead>Notes</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
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
						<TableCell className="text-muted-foreground">{dueDate}</TableCell>
						<TableCell className="text-muted-foreground">-</TableCell>
						<TableCell className="text-muted-foreground">-</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
