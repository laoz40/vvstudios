import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowRight, CircleX, Download, LoaderCircle, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import CheckedIcon from "#/components/ui/checked-icon";
import KeyframesIcon from "#/components/ui/keyframes-icon";
import { hasPermission } from "#/lib/permissions";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import {
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
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

	const sendDeliverablesEmail = useAction(
		api.editor.deliverablesEmail.sendSessionDeliverablesEmail
	);

	const accessResult = useQuery(api.shared.auth.getCurrentUserAccess, {});

	const canSendToClient =
		accessResult?.[1] !== undefined &&
		accessResult[1] !== null &&
		hasPermission(accessResult[1].permissions, "send:deliverables-email");

	const [isUpdating, setIsUpdating] = useState(false);
	const deliverableStatus: DeliverableStatus = session.editStatus ?? "to_edit";
	const stepIndex = editorSteps.findIndex((step) => step === deliverableStatus);
	const nextStatus = canManageDeliverables ? editorSteps[stepIndex + 1] : undefined;

	const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
	const reviewActionLabel = canSendToClient ? "Send to client" : "Send for review";

	async function sendForReview(notes: string) {
		if (!canSendToClient) {
			await changeStatus("review", undefined, notes);

			return;
		}

		setIsUpdating(true);

		const [emailError] = await tryCatch(
			sendDeliverablesEmail({ bookingId: session._id, editorNotes: notes })
		);

		if (emailError !== null) {
			setIsUpdating(false);
			toast.error(deliverablesEmailErrorToast(emailError.reason));

			return;
		}

		setIsReviewDialogOpen(false);
		await changeStatus("review", undefined, notes);
	}

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
			toast.error(
				editStatus === "review" && canSendToClient
					? "Deliverables email sent, but the status update failed."
					: "Unable to update this session's deliverables status."
			);

			return;
		}

		if (editStatus === "downloading" && previousStatus === "to_edit") {
			onDownloadingStarted();
		}

		setIsReviewDialogOpen(false);

		toast.success(
			editStatus === "review" && canSendToClient
				? `Deliverables email sent to ${session.name}.`
				: `${session.name} set to ${getDeliverableStatusLabel(editStatus)}`,
			{
				action:
					previousStatus === undefined || editStatus === "review"
						? undefined
						: { label: "Undo", onClick: () => void changeStatus(previousStatus) }
			}
		);
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
					disabled={isUpdating || (nextStatus === "review" && !accessResult?.[1])}
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
						? reviewActionLabel
						: `Set to ${getDeliverableStatusLabel(nextStatus)}`}
					<ArrowRight aria-hidden />
					<span className="sr-only">for {session.name}</span>
				</Button>
			)}
			{isReviewDialogOpen ? (
				<EditorSendForReviewDialog
					session={session}
					canSendToClient={canSendToClient}
					isSending={isUpdating}
					open
					onOpenChange={setIsReviewDialogOpen}
					onSend={(notes) => void sendForReview(notes)}
				/>
			) : null}
		</div>
	);
}
