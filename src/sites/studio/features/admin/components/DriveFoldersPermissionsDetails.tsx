import { useAction } from "convex/react";
import { Check, LoaderCircle, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { exhaustiveCheck, tryCatch, type Result } from "#/lib/result";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";

type ClientDrivePermissions = NonNullable<DriveDialogStatus["clientDrivePermissions"]>;

type EditorDrivePermissions = NonNullable<DriveDialogStatus["editorDrivePermissions"]>;

type DriveStatusRowVariant = "complete" | "attention" | "waiting";

function clientDrivePermissionsCompleteLabel(status: ClientDrivePermissions["status"]) {
	switch (status) {
		case "skipped":
			return "Client email is not a Google account (folder sharing skipped)";
		case "ready":
		case "failed":
		case "incomplete":
		case "not_created":
			return "Google Drive folders shared with the client";
		default:
			return exhaustiveCheck(status);
	}
}

function clientDrivePermissionsAttentionLabel(status: ClientDrivePermissions["status"]) {
	switch (status) {
		case "failed":
			return "Could not share Google Drive folders with the client email";
		case "incomplete":
			return "Client folder sharing did not finish. Retry to run it again";
		case "not_created":
			return "Client folder sharing has not been set up yet";
		case "ready":
		case "skipped":
			return "Google Drive folders shared with the client";
		default:
			return exhaustiveCheck(status);
	}
}

function areClientFolderPermissionsReadyForAssetsEmail(status: ClientDrivePermissions["status"]) {
	return status === "ready" || status === "skipped";
}

function clientAssetsEmailCompleteLabel(status: ClientDrivePermissions["assetsEmailStatus"]) {
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

function clientAssetsEmailAttentionLabel(status: ClientDrivePermissions["assetsEmailStatus"]) {
	switch (status) {
		case "failed":
			return "Assets email could not be sent to the client";
		case "not_sent":
			return "Assets email has not been sent to the client yet";
		case "pending":
			return "Assets email is being sent";
		case "sent":
		case "not_applicable":
			return "Assets email sent to client";
		default:
			return exhaustiveCheck(status);
	}
}

function isClientDrivePermissionsComplete(status: ClientDrivePermissions["status"]) {
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

function shouldRetryClientDrivePermissions(client: ClientDrivePermissions | undefined) {
	return client?.status === "failed" || client?.status === "incomplete";
}

function shouldRetryClientAssetsEmail(client: ClientDrivePermissions | undefined) {
	if (client === undefined) return false;

	if (client.assetsEmailStatus === "sent" || client.assetsEmailStatus === "not_applicable") {
		return false;
	}

	return areClientFolderPermissionsReadyForAssetsEmail(client.status);
}

function editorDrivePermissionsCompleteLabel() {
	return "Google Drive folders shared with the editor";
}

function editorDrivePermissionsAttentionLabel(
	status: EditorDrivePermissions["status"],
	driveFoldersReady: boolean
) {
	switch (status) {
		case "failed":
			return "Could not share session folders with the editor";
		case "pending":
			if (driveFoldersReady) {
				return "Editor has not been given access to the session folders yet";
			}

			return "Editor access will be set up after the session folders are ready";
		case "ready":
			return editorDrivePermissionsCompleteLabel();
		case "not_assigned":
			return "No editor assigned";
		default:
			return exhaustiveCheck(status);
	}
}

function editorAssignmentEmailCompleteLabel() {
	return "Assignment email sent to editor";
}

function editorAssignmentEmailAttentionLabel(
	status: EditorDrivePermissions["assignmentEmailStatus"]
) {
	switch (status) {
		case "failed":
			return "Assignment email could not be sent to the editor";
		case "not_sent":
			return "Assignment email has not been sent to the editor yet";
		case "pending":
			return "Assignment email is being sent";
		case "sent":
			return editorAssignmentEmailCompleteLabel();
		default:
			return exhaustiveCheck(status);
	}
}

function shouldRetryEditorAccess(
	editor: EditorDrivePermissions | undefined,
	driveFoldersReady: boolean
) {
	return editor?.status === "failed" || (driveFoldersReady && editor?.status === "pending");
}

function buildClientDrivePermissionsRow(client: ClientDrivePermissions) {
	const isComplete = isClientDrivePermissionsComplete(client.status);
	const variant: DriveStatusRowVariant = isComplete ? "complete" : "attention";

	return {
		variant,
		label: isComplete
			? clientDrivePermissionsCompleteLabel(client.status)
			: clientDrivePermissionsAttentionLabel(client.status),
		showRetry: shouldRetryClientDrivePermissions(client)
	};
}

function buildClientAssetsEmailRow(client: ClientDrivePermissions) {
	if (!areClientFolderPermissionsReadyForAssetsEmail(client.status)) {
		return {
			variant: "waiting" as const,
			label: "Assets email will send after client folder permissions are set up"
		};
	}

	const { assetsEmailStatus } = client;

	if (assetsEmailStatus === "sent" || assetsEmailStatus === "not_applicable") {
		return {
			variant: "complete" as const,
			label: clientAssetsEmailCompleteLabel(assetsEmailStatus)
		};
	}

	if (assetsEmailStatus === "pending") {
		return {
			variant: "waiting" as const,
			label: clientAssetsEmailAttentionLabel(assetsEmailStatus)
		};
	}

	return {
		variant: "attention" as const,
		label: clientAssetsEmailAttentionLabel(assetsEmailStatus)
	};
}

function buildEditorDrivePermissionsRow(
	editor: EditorDrivePermissions,
	driveFoldersReady: boolean
) {
	if (editor.status === "ready") {
		return {
			variant: "complete" as const,
			label: editorDrivePermissionsCompleteLabel(),
			showRetry: false
		};
	}

	const variant: DriveStatusRowVariant =
		editor.status === "pending" && !driveFoldersReady ? "waiting" : "attention";

	return {
		variant,
		label: editorDrivePermissionsAttentionLabel(editor.status, driveFoldersReady),
		showRetry: shouldRetryEditorAccess(editor, driveFoldersReady)
	};
}

function buildEditorAssignmentEmailRow(editor: EditorDrivePermissions) {
	if (editor.status !== "ready") {
		return {
			variant: "waiting" as const,
			label: "Assignment email will send after editor folder access is set up"
		};
	}

	if (editor.assignmentEmailStatus === "sent") {
		return { variant: "complete" as const, label: editorAssignmentEmailCompleteLabel() };
	}

	if (editor.assignmentEmailStatus === "pending") {
		return {
			variant: "waiting" as const,
			label: editorAssignmentEmailAttentionLabel(editor.assignmentEmailStatus)
		};
	}

	return {
		variant: "attention" as const,
		label: editorAssignmentEmailAttentionLabel(editor.assignmentEmailStatus)
	};
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
	variant,
	label,
	retry
}: {
	variant: "complete" | "attention" | "waiting";
	label: string;
	retry?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="flex items-center gap-2">
				{variant === "complete" ? (
					<Check
						className="size-4 text-primary"
						aria-hidden
					/>
				) : null}
				{variant === "attention" ? (
					<X
						className="size-4 text-destructive"
						aria-hidden
					/>
				) : null}
				<span className={variant === "waiting" ? "text-muted-foreground" : undefined}>{label}</span>
			</div>
			{variant === "attention" && retry !== undefined ? retry : null}
		</div>
	);
}

function ClientDrivePermissionRows({
	bookingId,
	clientDrivePermissions
}: {
	bookingId: Id<"bookings">;
	clientDrivePermissions: ClientDrivePermissions;
}) {
	const retryClientDrivePermissions = useAction(api.googleCalendar.retryClientDrivePermissions);
	const retryClientAssetsEmail = useAction(api.googleCalendar.retryClientAssetsEmail);
	const permissionsRow = buildClientDrivePermissionsRow(clientDrivePermissions);
	const assetsEmailRow = buildClientAssetsEmailRow(clientDrivePermissions);

	return (
		<>
			<DriveStatusRow
				variant={permissionsRow.variant}
				label={permissionsRow.label}
				retry={
					permissionsRow.showRetry ? (
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
				variant={assetsEmailRow.variant}
				label={assetsEmailRow.label}
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
	);
}

function EditorDrivePermissionRows({
	bookingId,
	driveFoldersReady,
	editorDrivePermissions
}: {
	bookingId: Id<"bookings">;
	driveFoldersReady: boolean;
	editorDrivePermissions: EditorDrivePermissions;
}) {
	const retryEditorAccess = useAction(api.drive.retryEditorAccess);
	const retryEditorAssignmentEmail = useAction(api.drive.retryEditorAssignmentEmail);
	const permissionsRow = buildEditorDrivePermissionsRow(editorDrivePermissions, driveFoldersReady);
	const assignmentEmailRow = buildEditorAssignmentEmailRow(editorDrivePermissions);

	return (
		<>
			<DriveStatusRow
				variant={permissionsRow.variant}
				label={permissionsRow.label}
				retry={
					permissionsRow.showRetry ? (
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
				variant={assignmentEmailRow.variant}
				label={assignmentEmailRow.label}
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
	);
}

function PreviousEditorRemovalRow({ bookingId }: { bookingId: Id<"bookings"> }) {
	const retryPreviousEditorRemoval = useAction(api.drive.retryPreviousEditorRemoval);

	return (
		<DriveStatusRow
			variant="attention"
			label="Could not remove the previous editor's access to the session folders"
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
	const clientDrivePermissionsToShow =
		clientDrivePermissions !== undefined && clientDrivePermissions.status !== "not_created"
			? clientDrivePermissions
			: undefined;

	const editorDrivePermissionsToShow =
		editorDrivePermissions !== undefined && editorDrivePermissions.status !== "not_assigned"
			? editorDrivePermissions
			: undefined;

	const showRemovalStatus = previousEditorRemovalFailed;

	if (
		clientDrivePermissionsToShow === undefined &&
		editorDrivePermissionsToShow === undefined &&
		!showRemovalStatus
	) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
			{clientDrivePermissionsToShow !== undefined ? (
				<ClientDrivePermissionRows
					bookingId={bookingId}
					clientDrivePermissions={clientDrivePermissionsToShow}
				/>
			) : null}
			{editorDrivePermissionsToShow !== undefined ? (
				<EditorDrivePermissionRows
					bookingId={bookingId}
					driveFoldersReady={driveFoldersReady}
					editorDrivePermissions={editorDrivePermissionsToShow}
				/>
			) : null}
			{showRemovalStatus ? <PreviousEditorRemovalRow bookingId={bookingId} /> : null}
		</div>
	);
}
