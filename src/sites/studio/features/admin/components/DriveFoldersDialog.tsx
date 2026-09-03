import { useAction, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { tryCatch } from "#/lib/result";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { DrivePermissionsDetails } from "#studio/features/admin/components/DriveFoldersPermissionsDetails";
import { DriveRetryActions } from "#studio/features/admin/components/DriveFoldersRetryActions";
import { SavedFolderLinks } from "#studio/features/admin/components/DriveFoldersSavedFolderLinks";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";
import {
	formatDriveSessionMediaFolderName,
	formatDriveSessionFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

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

function getSessionFolderLabel(driveStatus: DriveDialogStatus | null, sessionStartAt: number) {
	return driveStatus?.sessionFolderName ?? formatDriveSessionFolderName(sessionStartAt);
}

function hasSavedAssetsFolder(folders: NonNullable<DriveDialogStatus["folders"]>) {
	return folders.some((folder) => folder.name === "Assets" && folder.url !== undefined);
}

function getSavedFolderSections(driveStatus: DriveDialogStatus | null) {
	return { folders: driveStatus?.folders ?? [], packageFolderName: driveStatus?.packageFolderName };
}

function getDriveSetupButtonMode(status: DriveDialogStatus["status"] | undefined) {
	const shouldRetry = status === "incomplete" || status === "failed";
	const canSetUp = status === "not_created" || shouldRetry || status === "ready";
	return { canSetUp, shouldRetry };
}

function DriveSetupButton({
	bookingId,
	hasClientAssetsLibrary,
	status
}: {
	bookingId: Id<"bookings">;
	hasClientAssetsLibrary: boolean;
	status: DriveDialogStatus["status"] | undefined;
}) {
	const setupDriveFolders = useAction(api.googleCalendar.setupDrive);
	const retryDriveSetup = useAction(api.googleCalendar.retryDriveSetup);
	const [isSettingUp, setIsSettingUp] = useState(false);
	const { canSetUp, shouldRetry } = getDriveSetupButtonMode(status);

	if (!canSetUp) return null;

	async function handleSetup() {
		setIsSettingUp(true);
		const setupAction = shouldRetry ? retryDriveSetup : setupDriveFolders;
		const [error] = await tryCatch(setupAction({ bookingId }));
		setIsSettingUp(false);

		if (error !== null) {
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
						hasClientAssetsLibrary={hasClientAssetsLibrary}
						status={driveStatus?.status}
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
