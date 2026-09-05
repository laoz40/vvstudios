import { Check, X } from "lucide-react";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";

function clientDrivePermissionsCompleteLabel(
	status: NonNullable<DriveDialogStatus["clientDrivePermissions"]>["status"]
) {
	switch (status) {
		case "skipped":
			return "Client folder was not shared as a viewer. This email is not a Google account";
		case "ready":
		case "failed":
		case "incomplete":
		case "not_created":
			return "Google Drive permissions set up for client";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
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
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function DriveStatusRow({
	isComplete,
	completeLabel,
	attentionLabel
}: {
	isComplete: boolean;
	completeLabel: string;
	attentionLabel: string;
}) {
	return (
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
	);
}

export function DrivePermissionsDetails({
	clientDrivePermissions,
	editorDrivePermissions,
	previousEditorRemovalFailed
}: {
	clientDrivePermissions: DriveDialogStatus["clientDrivePermissions"] | undefined;
	editorDrivePermissions: DriveDialogStatus["editorDrivePermissions"] | undefined;
	previousEditorRemovalFailed: DriveDialogStatus["previousEditorRemovalFailed"];
}) {
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
					/>
					<DriveStatusRow
						isComplete={clientDrivePermissions.assetsEmailStatus === "sent"}
						completeLabel="Assets email sent to client"
						attentionLabel="Assets email not sent to client"
					/>
				</>
			) : null}
			{showEditorStatus ? (
				<>
					<DriveStatusRow
						isComplete={editorDrivePermissions.status === "ready"}
						completeLabel="Google Drive permissions set up for editor"
						attentionLabel="Google Drive permissions for editor need attention"
					/>
					<DriveStatusRow
						isComplete={editorDrivePermissions.assignmentEmailStatus === "sent"}
						completeLabel="Assignment email sent to editor"
						attentionLabel="Assignment email not sent to editor"
					/>
				</>
			) : null}
			{showRemovalStatus ? (
				<DriveStatusRow
					isComplete={false}
					completeLabel="Previous editor access removed"
					attentionLabel="Previous editor access removal failed"
				/>
			) : null}
		</div>
	);
}
