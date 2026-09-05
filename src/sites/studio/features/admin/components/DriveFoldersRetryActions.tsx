import { useAction } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { tryCatch, type Result } from "#/lib/result";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";

function DriveRetryButton({
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

function shouldRetryClientDrivePermissions(
	client: DriveDialogStatus["clientDrivePermissions"] | undefined
) {
	return (
		client?.status === "failed" ||
		client?.status === "incomplete" ||
		client?.assetsEmailStatus === "failed"
	);
}

function shouldRetryEditorAccess(
	editor: DriveDialogStatus["editorDrivePermissions"] | undefined,
	driveFoldersReady: boolean
) {
	// Pending editor access can only be retried once the folders it shares exist.
	return editor?.status === "failed" || (driveFoldersReady && editor?.status === "pending");
}

function getDriveErrorStatus(driveStatus: DriveDialogStatus | null) {
	const editor = driveStatus?.editorDrivePermissions;
	return {
		client: shouldRetryClientDrivePermissions(driveStatus?.clientDrivePermissions),
		editorAccess: shouldRetryEditorAccess(editor, driveStatus?.status === "ready"),
		editorEmail: editor?.status === "ready" && editor.assignmentEmailStatus === "failed",
		previousEditorRemoval: driveStatus?.previousEditorRemovalFailed ?? false
	};
}

export function DriveRetryActions({
	bookingId,
	driveStatus
}: {
	bookingId: Id<"bookings">;
	driveStatus: DriveDialogStatus | null;
}) {
	const retryClientDrivePermissions = useAction(api.googleCalendar.retryClientDrivePermissions);
	const retryEditorAccess = useAction(api.drive.retryEditorAccess);
	const retryEditorAssignmentEmail = useAction(api.drive.retryEditorAssignmentEmail);
	const retryPreviousEditorRemoval = useAction(api.drive.retryPreviousEditorRemoval);
	const errorStatus = getDriveErrorStatus(driveStatus);

	return (
		<>
			{errorStatus.client && (
				<DriveRetryButton
					run={() => retryClientDrivePermissions({ bookingId })}
					label="Retry client permissions"
					pendingLabel="Retrying"
					errorMessage="Client folder permissions could not be completed."
					successMessage="Client folder permissions updated."
				/>
			)}
			{errorStatus.editorAccess && (
				<DriveRetryButton
					run={() => retryEditorAccess({ bookingId })}
					label="Retry editor access"
					pendingLabel="Retrying"
					errorMessage="Editor Google Drive access could not be completed."
					successMessage="Editor access updated."
				/>
			)}
			{errorStatus.editorEmail && (
				<DriveRetryButton
					run={() => retryEditorAssignmentEmail({ bookingId })}
					label="Retry assignment email"
					pendingLabel="Sending"
					errorMessage="Editor assignment email could not be sent."
					successMessage="Assignment email sent."
				/>
			)}
			{errorStatus.previousEditorRemoval && (
				<DriveRetryButton
					run={() => retryPreviousEditorRemoval({ bookingId })}
					label="Retry previous editor removal"
					pendingLabel="Retrying"
					errorMessage="Previous editor access could not be removed."
					successMessage="Previous editor access removed."
				/>
			)}
		</>
	);
}
