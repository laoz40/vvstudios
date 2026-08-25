import { useAction, useQuery } from "convex/react";
import { Check, ExternalLink, Folder, FolderOpen, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { tryCatch, type Result } from "#/lib/result";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { useState } from "react";
import {
	formatDriveSessionMediaFolderName,
	formatDriveSessionFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

type DriveStatus = "failed" | "not_created" | "incomplete" | "ready";
type ClientDrivePermissionsStatus = {
	status: DriveStatus;
	assetsEmailStatus: "failed" | "not_sent" | "pending" | "sent";
};
type EditorDrivePermissionsStatus = {
	status: "failed" | "not_assigned" | "pending" | "ready";
	assignmentEmailStatus: "failed" | "not_sent" | "pending" | "sent";
};

type SavedFolder = { name: string; url?: string };

function getSessionChildFolderName({
	folderName,
	rawMediaFolderName,
	deliverablesFolderName
}: {
	folderName: string;
	rawMediaFolderName: string;
	deliverablesFolderName: string;
}) {
	switch (folderName) {
		case "Raw Media":
			return rawMediaFolderName;
		case "Deliverables":
			return deliverablesFolderName;
		default:
			return folderName;
	}
}

function getDriveDescription({
	status,
	hasClientAssetsLibrary,
	clientName,
	accountName
}: {
	status: DriveStatus | undefined;
	hasClientAssetsLibrary: boolean;
	clientName: string;
	accountName: string;
}) {
	switch (status) {
		case "ready":
			return accountName.trim() && accountName.trim() !== clientName.trim()
				? `${clientName} · ${accountName}`
				: clientName;
		case "failed":
			return "Google Drive folders could not be created. Retry the setup manually.";
		case "incomplete":
			if (hasClientAssetsLibrary) return "Folder not created for this session.";
			return "Google Drive folders not created completely.";
		case "not_created":
		case undefined:
			return "Google Drive folders have not been created. Setup may not have run yet, or it may have been skipped because the session changed or was cancelled.";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function SavedFolderLinks({
	folders,
	sessionFolderName,
	rawMediaFolderName,
	deliverablesFolderName
}: {
	folders: SavedFolder[];
	sessionFolderName: string;
	rawMediaFolderName: string;
	deliverablesFolderName: string;
}) {
	const sessionFolder = folders.find((folder) => folder.name === "Session");
	const assetsFolder = folders.find((folder) => folder.name === "Assets");
	const sessionChildFolders = folders.filter(
		(folder) => folder.name !== "Session" && folder.name !== "Assets"
	);

	if (folders.length === 0) return null;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Client assets library</p>
				{assetsFolder?.url ? (
					<Button
						variant="outline"
						className="w-full justify-start"
						asChild>
						<a
							href={assetsFolder.url}
							target="_blank"
							rel="noreferrer">
							<FolderOpen
								data-icon="inline-start"
								aria-hidden
							/>
							_Assets
							<ExternalLink
								data-icon="inline-end"
								aria-hidden
							/>
						</a>
					</Button>
				) : (
					<p className="text-sm text-muted-foreground">_Assets: not created</p>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Session folders</p>
				<div>
					{sessionFolder?.url ? (
						<Button
							variant="outline"
							className="w-full justify-start"
							asChild>
							<a
								href={sessionFolder.url}
								target="_blank"
								rel="noreferrer">
								<FolderOpen
									data-icon="inline-start"
									aria-hidden
								/>
								{sessionFolderName}
								<ExternalLink
									data-icon="inline-end"
									aria-hidden
								/>
							</a>
						</Button>
					) : (
						<div className="flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
							<Folder
								className="size-4"
								aria-hidden
							/>
							Not created
						</div>
					)}
				</div>

				{sessionChildFolders.length > 0 ? (
					<div className="ml-3 flex flex-col gap-2 border-l pl-3">
						{sessionChildFolders.map((folder) => {
							const folderName = getSessionChildFolderName({
								folderName: folder.name,
								rawMediaFolderName,
								deliverablesFolderName
							});
							if (!folder.url) {
								return (
									<p
										key={folder.name}
										className="text-sm text-muted-foreground">
										{folderName}: not created
									</p>
								);
							}

							return (
								<Button
									key={folder.name}
									variant="secondary"
									className="justify-start"
									asChild>
									<a
										href={folder.url}
										target="_blank"
										rel="noreferrer">
										<Folder
											data-icon="inline-start"
											aria-hidden
										/>
										{folderName}
										<ExternalLink
											data-icon="inline-end"
											aria-hidden
										/>
									</a>
								</Button>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);
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

function DrivePermissionsDetails({
	clientDrivePermissions,
	editorDrivePermissions
}: {
	clientDrivePermissions: ClientDrivePermissionsStatus | undefined;
	editorDrivePermissions: EditorDrivePermissionsStatus | undefined;
}) {
	const showClientStatus =
		clientDrivePermissions !== undefined && clientDrivePermissions.status !== "not_created";
	const showEditorStatus =
		editorDrivePermissions !== undefined && editorDrivePermissions.status !== "not_assigned";

	if (!showClientStatus && !showEditorStatus) return null;

	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
			{showClientStatus ? (
				<>
					<DriveStatusRow
						isComplete={clientDrivePermissions.status === "ready"}
						completeLabel="Google Drive permissions set up for client"
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
		</div>
	);
}

function getDriveRetryVisibility({
	client,
	editor,
	driveFoldersReady
}: {
	client: ClientDrivePermissionsStatus | undefined;
	editor: EditorDrivePermissionsStatus | undefined;
	driveFoldersReady: boolean;
}) {
	return {
		client:
			client?.status === "failed" ||
			client?.status === "incomplete" ||
			client?.assetsEmailStatus === "failed",
		editorAccess:
			editor?.status === "failed" || (driveFoldersReady && editor?.status === "pending"),
		editorEmail: editor?.status === "ready" && editor.assignmentEmailStatus === "failed"
	};
}

function DriveRetryButton({
	show,
	run,
	label,
	pendingLabel,
	errorMessage,
	successMessage
}: {
	show: boolean;
	run: () => Promise<Result<unknown, { reason: string }>>;
	label: string;
	pendingLabel: string;
	errorMessage: string;
	successMessage: string;
}) {
	const [isRunning, setIsRunning] = useState(false);

	if (!show) return null;

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

function DriveSetupButton({
	bookingId,
	status,
	hasClientAssetsLibrary
}: {
	bookingId: Id<"bookings">;
	status: DriveStatus | undefined;
	hasClientAssetsLibrary: boolean;
}) {
	const setupDriveFolders = useAction(api.googleCalendar.setupDrive);
	const retryDriveSetup = useAction(api.googleCalendar.retryDriveSetup);
	const [isSettingUp, setIsSettingUp] = useState(false);
	const shouldRetry = status === "incomplete" || status === "failed";
	const canSetUp = status === "not_created" || shouldRetry;

	if (!canSetUp) return null;

	async function handleSetup() {
		setIsSettingUp(true);
		const setupAction = shouldRetry ? retryDriveSetup : setupDriveFolders;
		const [error] = await tryCatch(setupAction({ bookingId }));
		setIsSettingUp(false);

		if (error) {
			toast.error("Google Drive folders could not be created.");
			return;
		}
		toast.success("Google Drive folders created.");
	}

	let label = "Set up Google Drive folders";
	if (shouldRetry) label = "Retry Google Drive folders";
	if (shouldRetry && hasClientAssetsLibrary) label = "Create Google Drive folders";
	if (isSettingUp) label = hasClientAssetsLibrary ? "Creating" : "Setting up";

	return (
		<Button
			type="button"
			disabled={isSettingUp}
			onClick={() => void handleSetup()}>
			{isSettingUp ? (
				<LoaderCircle
					className="animate-spin"
					aria-hidden
				/>
			) : null}
			{label}
		</Button>
	);
}

export function DriveFoldersDialog({
	bookingId,
	clientName,
	accountName,
	sessionDate,
	sessionTime,
	open,
	onOpenChange
}: {
	bookingId: Id<"bookings">;
	clientName: string;
	accountName: string;
	sessionDate: string;
	sessionTime: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const retryClientDrivePermissions = useAction(api.googleCalendar.retryClientDrivePermissions);
	const retryEditorAccess = useAction(api.drive.retryEditorAccess);
	const retryEditorAssignmentEmail = useAction(api.drive.retryEditorAssignmentEmail);
	const driveResult = useQuery(api.sessions.getDriveStatus, open ? { bookingId } : "skip");
	const driveStatus = driveResult?.[1] ?? null;
	const savedFolders = driveStatus && "folders" in driveStatus ? (driveStatus.folders ?? []) : [];
	const hasClientAssetsLibrary = savedFolders.some(
		(folder) => folder.name === "Assets" && folder.url !== undefined
	);
	const clientDrivePermissions = driveStatus?.clientDrivePermissions;
	const editorDrivePermissions = driveStatus?.editorDrivePermissions;
	const retryVisibility = getDriveRetryVisibility({
		client: clientDrivePermissions,
		editor: editorDrivePermissions,
		driveFoldersReady: driveStatus?.status === "ready"
	});
	const sessionStartAt = getBookingStartTimestamp(sessionDate, sessionTime);
	const sessionFolderName = formatDriveSessionFolderName(sessionStartAt);
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Google Drive folders</DialogTitle>
					<DialogDescription>
						{getDriveDescription({
							status: driveStatus?.status,
							hasClientAssetsLibrary,
							clientName,
							accountName
						})}
					</DialogDescription>
				</DialogHeader>
				<SavedFolderLinks
					folders={savedFolders}
					sessionFolderName={sessionFolderName}
					rawMediaFolderName={formatDriveSessionMediaFolderName("Raw Media", sessionStartAt)}
					deliverablesFolderName={formatDriveSessionMediaFolderName("Deliverables", sessionStartAt)}
				/>
				<DrivePermissionsDetails
					clientDrivePermissions={clientDrivePermissions}
					editorDrivePermissions={editorDrivePermissions}
				/>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<DriveSetupButton
						bookingId={bookingId}
						status={driveStatus?.status}
						hasClientAssetsLibrary={hasClientAssetsLibrary}
					/>
					<DriveRetryButton
						show={retryVisibility.client}
						run={() => retryClientDrivePermissions({ bookingId })}
						label="Retry client permissions"
						pendingLabel="Retrying"
						errorMessage="Client folder permissions could not be completed."
						successMessage="Client folder permissions updated."
					/>
					<DriveRetryButton
						show={retryVisibility.editorAccess}
						run={() => retryEditorAccess({ bookingId })}
						label="Retry editor access"
						pendingLabel="Retrying"
						errorMessage="Editor Google Drive access could not be completed."
						successMessage="Editor access updated."
					/>
					<DriveRetryButton
						show={retryVisibility.editorEmail}
						run={() => retryEditorAssignmentEmail({ bookingId })}
						label="Retry assignment email"
						pendingLabel="Sending"
						errorMessage="Editor assignment email could not be sent."
						successMessage="Assignment email sent."
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
