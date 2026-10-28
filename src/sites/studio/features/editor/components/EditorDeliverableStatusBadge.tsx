import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRight, CircleX, Download, LoaderCircle, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import CheckedIcon from "#/components/ui/checked-icon";
import KeyframesIcon from "#/components/ui/keyframes-icon";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import {
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import { EditorSendForReviewDialog } from "#studio/features/editor/components/EditorSendForReviewDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

const editorSteps = ["to_edit", "downloading", "editing", "uploading", "review"] as const;

const deliverableBadgeClassName = "px-1.5 text-sm leading-tight [&>svg]:size-4";

function getDeliverableStatusLabel(status: DeliverableStatus) {
	if (status === "review") {
		return "Sent for review";
	}

	if (status === "to_edit") {
		return "Not started";
	}

	return deliverableStatusLabelMap[status];
}

function DeliverableStatusIcon({ status }: { status: DeliverableStatus }) {
	const Icon = {
		to_edit: CircleX,
		downloading: Download,
		editing: KeyframesIcon,
		uploading: Upload,
		review: CheckedIcon,
		completed: Send
	}[status];

	return (
		<Icon
			size={16}
			aria-hidden
			className="shrink-0 text-current"
		/>
	);
}

export function EditorDeliverableStatusBadge({
	session,
	canManageDeliverables,
	onDownloadingStarted
}: {
	session: EditorSession;
	canManageDeliverables: boolean;
	onDownloadingStarted: () => void;
}) {
	const updateSessionEditStatus = useMutation(api.sessions.admin.updateSessionEditStatus);
	const [isUpdating, setIsUpdating] = useState(false);
	const deliverableStatus: DeliverableStatus = session.editStatus ?? "to_edit";
	const stepIndex = editorSteps.findIndex((step) => step === deliverableStatus);
	const nextStatus = canManageDeliverables ? editorSteps[stepIndex + 1] : undefined;

	const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

	async function changeStatus(
		editStatus: DeliverableStatus,
		previousStatus?: DeliverableStatus,
		deliverablesClientNotes?: string
	) {
		setIsUpdating(true);

		const [error] = await tryCatch(
			updateSessionEditStatus({ bookingId: session._id, editStatus, deliverablesClientNotes })
		);

		setIsUpdating(false);

		if (error !== null) {
			toast.error("Unable to update this session's deliverables status.");

			return;
		}

		if (editStatus === "downloading" && previousStatus === "to_edit") {
			onDownloadingStarted();
		}

		setIsReviewDialogOpen(false);

		toast.success(`${session.name} set to ${getDeliverableStatusLabel(editStatus)}`, {
			action:
				previousStatus === undefined || editStatus === "review"
					? undefined
					: { label: "Undo", onClick: () => void changeStatus(previousStatus) }
		});
	}

	return (
		<div className="flex flex-col items-start gap-1.5">
			<Badge
				variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
				className={cn(
					deliverableStatusBadgeClassNameMap[deliverableStatus],
					deliverableBadgeClassName
				)}>
				<DeliverableStatusIcon status={deliverableStatus} />
				{stepIndex === -1 ? null : (
					<span className="tabular-nums opacity-70">
						{stepIndex + 1}/{editorSteps.length}
					</span>
				)}
				{getDeliverableStatusLabel(deliverableStatus)}
			</Badge>
			{nextStatus === undefined ? null : (
				<Button
					type="button"
					variant="outline"
					size="xs"
					disabled={isUpdating}
					onClick={() =>
						nextStatus === "review"
							? setIsReviewDialogOpen(true)
							: void changeStatus(nextStatus, deliverableStatus)
					}>
					{isUpdating ? (
						<LoaderCircle
							className="animate-spin"
							aria-hidden
						/>
					) : null}
					{nextStatus === "review"
						? "Send for review"
						: `Set to ${getDeliverableStatusLabel(nextStatus)}`}
					<ArrowRight aria-hidden />
					<span className="sr-only">for {session.name}</span>
				</Button>
			)}
			{isReviewDialogOpen ? (
				<EditorSendForReviewDialog
					session={session}
					isSending={isUpdating}
					open
					onOpenChange={setIsReviewDialogOpen}
					onSend={(notes) => void changeStatus("review", deliverableStatus, notes)}
				/>
			) : null}
		</div>
	);
}
