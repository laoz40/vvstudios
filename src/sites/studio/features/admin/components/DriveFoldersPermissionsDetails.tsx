import { useAction } from "convex/react";
import { Check, LoaderCircle, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { exhaustiveCheck, tryCatch, type Result } from "#/lib/result";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";

function clientDrivePermissionsCompleteLabel(
	status: NonNullable<DriveDialogStatus["clientDrivePermissions"]>["status"]
) {
	switch (status) {
		case "skipped":
			return "Client email is not a Google account (folder sharing skipped)";
		case "ready":
		case "failed":
		case "incomplete":
		case "not_created":
			return "Google Drive permissions set up for client";
		default:
			return exhaustiveCheck(status);
	}
}

function isClientAssetsEmailComplete(
	status: NonNullable<DriveDialogStatus["clientDrivePermissions"]>["assetsEmailStatus"]
) {
	switch (status) {
		case "sent":
		case "not_applicable":
			return true;
		case "failed":
		case "not_sent":
		case "pending":
			return false;
		default:
			return exhaustiveCheck(status);
	}
}

function clientAssetsEmailCompleteLabel(
	status: NonNullable<DriveDialogStatus["clientDrivePermissions"]>["assetsEmailStatus"]
) {
	switch (status) {
		case "sent":
			return "Assets email sent to client";
		case "not_applicable":
			return "Assets email not required for this booking";
		case "failed":
		case "not_sent":
		case "pending":
			return "Assets email sent to client";
		default:
			return exhaustiveCheck(status);
	}
}

function isClientDrivePermissionsComplete(
	status: NonNullable<DriveDialogStatus["clientDrivePermissions"]>["status"]
) {
	switch (status) {
		case "ready":
		case "skipped":
			return true;
		case "failed":
		case "incomplete":
		case "not_created":
			return false;
		default:
			return exhaustiveCheck(status);
	}
}

function shouldRetryClientDrivePermissions(
	client: DriveDialogStatus["clientDrivePermissions"] | undefined
) {
	return client?.status === "failed" || client?.status === "incomplete";
}

function shouldRetryClientAssetsEmail(
	client: DriveDialogStatus["clientDrivePermissions"] | undefined
) {
	if (client === undefined || client.assetsEmailStatus === "sent") return false;

	return client.status === "ready" || client.status === "skipped";
}

function shouldRetryEditorAccess(
	editor: DriveDialogStatus["editorDrivePermissions"] | undefined,
	driveFoldersReady: boolean
) {
	return editor?.status === "failed" || (driveFoldersReady && editor?.status === "pending");
}

function DriveInlineRetryButton({
	run,
	label,
	pendingLabel,
	errorMessage,
	successMessage
}: {
	run: () => Promise<Result<unknown, { reason: string }>>;
	label: string;
	pendingLabel: string;
	errorMessage: string;
	successMessage: string;
}) {
	const [isRunning, setIsRunning] = useState(false);

	async function handleRetry() {
		setIsRunning(true);
		const [error] = await tryCatch(run());
		setIsRunning(false);

		if (error !== null) {
			toast.error(errorMessage);

			return;
		}

		toast.success(successMessage);
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={isRunning}
			onClick={() => void handleRetry()}>
			{isRunning ? (
				<LoaderCircle
					className="animate-spin"
					aria-hidden
				/>
			) : null}
			{isRunning ? pendingLabel : label}
		</Button>
	);
}

function DriveStatusRow({
	isComplete,
	completeLabel,
	attentionLabel,
	retry
}: {
	isComplete: boolean;
	completeLabel: string;
	attentionLabel: string;
	retry?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="flex items-center gap-2">
				{isComplete ? (
					<Check
						className="size-4 text-primary"
						aria-hidden
					/>
				) : (
					<X
						className="size-4 text-destructive"
						aria-hidden
					/>
				)}
				<span>{isComplete ? completeLabel : attentionLabel}</span>
			</div>
			{!isComplete && retry !== undefined ? retry : null}
		</div>
	);
}

export function DrivePermissionsDetails({
	bookingId,
	clientDrivePermissions,
	driveFoldersReady,
	editorDrivePermissions,
	previousEditorRemovalFailed
}: {
	bookingId: Id<"bookings">;
	clientDrivePermissions: DriveDialogStatus["clientDrivePermissions"] | undefined;
	driveFoldersReady: boolean;
	editorDrivePermissions: DriveDialogStatus["editorDrivePermissions"] | undefined;
	previousEditorRemovalFailed: DriveDialogStatus["previousEditorRemovalFailed"];
}) {
	const retryClientDrivePermissions = useAction(api.googleCalendar.retryClientDrivePermissions);
	const retryClientAssetsEmail = useAction(api.googleCalendar.retryClientAssetsEmail);
	const retryEditorAccess = useAction(api.drive.retryEditorAccess);
	const retryEditorAssignmentEmail = useAction(api.drive.retryEditorAssignmentEmail);
	const retryPreviousEditorRemoval = useAction(api.drive.retryPreviousEditorRemoval);

	const showClientStatus =
		clientDrivePermissions !== undefined && clientDrivePermissions.status !== "not_created";

	const showEditorStatus =
		editorDrivePermissions !== undefined && editorDrivePermissions.status !== "not_assigned";

	const showRemovalStatus = previousEditorRemovalFailed;

	if (!showClientStatus && !showEditorStatus && !showRemovalStatus) return null;

	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
			{showClientStatus ? (
				<>
					<DriveStatusRow
						isComplete={isClientDrivePermissionsComplete(clientDrivePermissions.status)}
						completeLabel={clientDrivePermissionsCompleteLabel(clientDrivePermissions.status)}
						attentionLabel="Google Drive permissions for client need attention"
						retry={
							shouldRetryClientDrivePermissions(clientDrivePermissions) ? (
								<DriveInlineRetryButton
									run={() => retryClientDrivePermissions({ bookingId })}
									label="Retry"
									pendingLabel="Retrying"
									errorMessage="Client folder permissions could not be completed."
									successMessage="Client folder permissions updated."
								/>
							) : undefined
						}
					/>
					<DriveStatusRow
						isComplete={isClientAssetsEmailComplete(clientDrivePermissions.assetsEmailStatus)}
						completeLabel={clientAssetsEmailCompleteLabel(clientDrivePermissions.assetsEmailStatus)}
						attentionLabel="Assets email not sent to client"
						retry={
							shouldRetryClientAssetsEmail(clientDrivePermissions) ? (
								<DriveInlineRetryButton
									run={() => retryClientAssetsEmail({ bookingId })}
									label="Retry"
									pendingLabel="Sending"
									errorMessage="Assets email could not be sent."
									successMessage="Assets email sent."
								/>
							) : undefined
						}
					/>
				</>
			) : null}
			{showEditorStatus ? (
				<>
					<DriveStatusRow
						isComplete={editorDrivePermissions.status === "ready"}
						completeLabel="Google Drive permissions set up for editor"
						attentionLabel="Google Drive permissions for editor need attention"
						retry={
							shouldRetryEditorAccess(editorDrivePermissions, driveFoldersReady) ? (
								<DriveInlineRetryButton
									run={() => retryEditorAccess({ bookingId })}
									label="Retry"
									pendingLabel="Retrying"
									errorMessage="Editor Google Drive access could not be completed."
									successMessage="Editor access updated."
								/>
							) : undefined
						}
					/>
					<DriveStatusRow
						isComplete={editorDrivePermissions.assignmentEmailStatus === "sent"}
						completeLabel="Assignment email sent to editor"
						attentionLabel="Assignment email not sent to editor"
						retry={
							editorDrivePermissions.status === "ready" &&
							editorDrivePermissions.assignmentEmailStatus === "failed" ? (
								<DriveInlineRetryButton
									run={() => retryEditorAssignmentEmail({ bookingId })}
									label="Retry"
									pendingLabel="Sending"
									errorMessage="Editor assignment email could not be sent."
									successMessage="Assignment email sent."
								/>
							) : undefined
						}
					/>
				</>
			) : null}
			{showRemovalStatus ? (
				<DriveStatusRow
					isComplete={false}
					completeLabel="Previous editor access removed"
					attentionLabel="Previous editor access removal failed"
					retry={
						<DriveInlineRetryButton
							run={() => retryPreviousEditorRemoval({ bookingId })}
							label="Retry"
							pendingLabel="Retrying"
							errorMessage="Previous editor access could not be removed."
							successMessage="Previous editor access removed."
						/>
					}
				/>
			) : null}
		</div>
	);
}
