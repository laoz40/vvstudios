import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	Check,
	ExternalLink,
	Folder,
	FolderOpen,
	LoaderCircle,
	X,
	type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
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
import {
	formatDriveSessionMediaFolderName,
	formatDriveSessionFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

// The ok payload of the query's [error, data] Result tuple; null while loading or on failure.
type DriveDialogStatus = NonNullable<FunctionReturnType<typeof api.sessions.getDriveStatus>[1]>;

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
	status: DriveDialogStatus["status"] | undefined;
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

function FolderLink({
	url,
	label,
	icon: Icon,
	variant,
	className,
	fallback
}: {
	url: string | undefined;
	label: string;
	icon: LucideIcon;
	variant: "outline" | "secondary";
	className: string;
	fallback: ReactNode;
}) {
	if (!url) return fallback;

	return (
		<Button
			variant={variant}
			className={className}
			asChild>
			<a
				href={url}
				target="_blank"
				rel="noreferrer">
				<Icon
					data-icon="inline-start"
					aria-hidden
				/>
				{label}
				<ExternalLink
					data-icon="inline-end"
					aria-hidden
				/>
			</a>
		</Button>
	);
}

function NotCreatedFolderRow() {
	return (
		<div className="flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
			<Folder
				className="size-4"
				aria-hidden
			/>
			Not created
		</div>
	);
}

function SavedFolderLinks({
	folders,
	sessionFolderName,
	packageFolderName,
	rawMediaFolderName,
	deliverablesFolderName
}: {
	folders: NonNullable<DriveDialogStatus["folders"]>;
	sessionFolderName: string;
	packageFolderName: string | undefined;
	rawMediaFolderName: string;
	deliverablesFolderName: string;
}) {
	const assetsFolder = folders.find((folder) => folder.name === "Assets");
	const packageFolder = folders.find((folder) => folder.name === "Package");
	const sessionFolder = folders.find((folder) => folder.name === "Session");
	const sessionChildFolders = folders.filter(
		(folder) => folder.name !== "Session" && folder.name !== "Assets" && folder.name !== "Package"
	);

	if (folders.length === 0) return null;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Client assets library</p>
				<FolderLink
					url={assetsFolder?.url}
					label="_Assets"
					icon={FolderOpen}
					variant="outline"
					className="w-full justify-start"
					fallback={<p className="text-sm text-muted-foreground">_Assets: not created</p>}
				/>
			</div>

			{packageFolderName !== undefined ? (
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Package folder</p>
					<FolderLink
						url={packageFolder?.url}
						label={packageFolderName}
						icon={FolderOpen}
						variant="outline"
						className="w-full justify-start"
						fallback={<NotCreatedFolderRow />}
					/>
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Session folders</p>
				<FolderLink
					url={sessionFolder?.url}
					label={sessionFolderName}
					icon={FolderOpen}
					variant="outline"
					className="w-full justify-start"
					fallback={<NotCreatedFolderRow />}
				/>

				{sessionChildFolders.length > 0 ? (
					<div className="ml-3 flex flex-col gap-2 border-l pl-3">
						{sessionChildFolders.map((folder) => {
							const folderName = getSessionChildFolderName({
								folderName: folder.name,
								rawMediaFolderName,
								deliverablesFolderName
							});
							return (
								<FolderLink
									key={folder.name}
									url={folder.url}
									label={folderName}
									icon={Folder}
									variant="secondary"
									className="justify-start"
									fallback={
										<p className="text-sm text-muted-foreground">{folderName}: not created</p>
									}
								/>
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

function getSessionFolderLabel(driveStatus: DriveDialogStatus | null, sessionStartAt: number) {
	return driveStatus?.sessionFolderName ?? formatDriveSessionFolderName(sessionStartAt);
}

function hasSavedAssetsFolder(folders: NonNullable<DriveDialogStatus["folders"]>) {
	return folders.some((folder) => folder.name === "Assets" && folder.url !== undefined);
}

function getSavedFolderSections(driveStatus: DriveDialogStatus | null) {
	return { folders: driveStatus?.folders ?? [], packageFolderName: driveStatus?.packageFolderName };
}

function DriveSetupButton({
	bookingId,
	status,
	hasClientAssetsLibrary
}: {
	bookingId: Id<"bookings">;
	status: DriveDialogStatus["status"] | undefined;
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

function DriveRetryActions({
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

function DriveIdentityWarnings({
	bookingEmailChanged,
	workspaceNameChanged
}: {
	bookingEmailChanged: boolean;
	workspaceNameChanged: boolean;
}) {
	if (!bookingEmailChanged && !workspaceNameChanged) return null;

	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
			{bookingEmailChanged ? (
				<p>
					This booking now uses a different email. Drive sharing is still with the original email
					and does not switch automatically.
				</p>
			) : null}
			{workspaceNameChanged ? (
				<p>
					The account name on this booking no longer matches the client folder in Google Drive. That
					folder is not renamed automatically.
				</p>
			) : null}
		</div>
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
	const driveResult = useQuery(api.sessions.getDriveStatus, open ? { bookingId } : "skip");
	const driveStatus = driveResult?.[1] ?? null;
	const { folders: savedFolders, packageFolderName } = getSavedFolderSections(driveStatus);
	// The client assets library exists when its folder was created during setup.
	const hasClientAssetsLibrary = hasSavedAssetsFolder(savedFolders);
	const sessionStartAt = getBookingStartTimestamp(sessionDate, sessionTime);
	const sessionFolderName = getSessionFolderLabel(driveStatus, sessionStartAt);
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
				<DriveIdentityWarnings
					bookingEmailChanged={driveStatus?.bookingEmailChanged ?? false}
					workspaceNameChanged={driveStatus?.workspaceNameChanged ?? false}
				/>
				<SavedFolderLinks
					folders={savedFolders}
					sessionFolderName={sessionFolderName}
					packageFolderName={packageFolderName}
					rawMediaFolderName={formatDriveSessionMediaFolderName("Raw Media", sessionStartAt)}
					deliverablesFolderName={formatDriveSessionMediaFolderName("Deliverables", sessionStartAt)}
				/>
				<DrivePermissionsDetails
					clientDrivePermissions={driveStatus?.clientDrivePermissions}
					editorDrivePermissions={driveStatus?.editorDrivePermissions}
					previousEditorRemovalFailed={driveStatus?.previousEditorRemovalFailed ?? false}
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
					<DriveRetryActions
						bookingId={bookingId}
						driveStatus={driveStatus}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
