import { useAction, useQuery } from "convex/react";
import { Check, ExternalLink, Folder, FolderOpen, LoaderCircle, X } from "lucide-react";
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

function ClientDrivePermissionsDetails({
	clientDrivePermissions
}: {
	clientDrivePermissions: ClientDrivePermissionsStatus | undefined;
}) {
	if (clientDrivePermissions === undefined || clientDrivePermissions.status === "not_created") {
		return null;
	}

	const hasFolderAccess = clientDrivePermissions.status === "ready";
	const hasSentAssetsEmail = clientDrivePermissions.assetsEmailStatus === "sent";

	return (
		<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
			<div className="flex items-center gap-2">
				{hasFolderAccess ? (
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
				<span>
					{hasFolderAccess
						? "Google Drive permissions set up"
						: "Google Drive permissions needs attention"}
				</span>
			</div>
			<div className="flex items-center gap-2">
				{hasSentAssetsEmail ? (
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
				<span>
					{hasSentAssetsEmail ? "Assets email sent to client" : "Assets email not sent to client"}
				</span>
			</div>
		</div>
	);
}

function ClientDrivePermissionsRetryButton({
	bookingId,
	clientDrivePermissions
}: {
	bookingId: Id<"bookings">;
	clientDrivePermissions: ClientDrivePermissionsStatus | undefined;
}) {
	const retryClientDrivePermissions = useAction(api.googleCalendar.retryClientDrivePermissions);
	const [isRetrying, setIsRetrying] = useState(false);
	const canRetry =
		clientDrivePermissions?.status === "failed" ||
		clientDrivePermissions?.status === "incomplete" ||
		clientDrivePermissions?.assetsEmailStatus === "failed";

	if (!canRetry) return null;

	async function handleRetry() {
		setIsRetrying(true);
		const [error] = await tryCatch(retryClientDrivePermissions({ bookingId }));
		setIsRetrying(false);

		if (error) {
			toast.error("Client folder permissions could not be completed.");
			return;
		}
		toast.success("Client folder permissions updated.");
	}

	return (
		<Button
			type="button"
			disabled={isRetrying}
			onClick={() => void handleRetry()}>
			{isRetrying ? (
				<LoaderCircle
					className="animate-spin"
					aria-hidden
				/>
			) : null}
			{isRetrying ? "Retrying" : "Retry client permissions"}
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
	const driveResult = useQuery(api.sessions.getDriveStatus, open ? { bookingId } : "skip");
	const driveStatus = driveResult?.[1] ?? null;
	const savedFolders = driveStatus && "folders" in driveStatus ? (driveStatus.folders ?? []) : [];
	const hasClientAssetsLibrary = savedFolders.some(
		(folder) => folder.name === "Assets" && folder.url !== undefined
	);
	const clientDrivePermissions = driveStatus?.clientDrivePermissions;
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
				<ClientDrivePermissionsDetails clientDrivePermissions={clientDrivePermissions} />
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
					<ClientDrivePermissionsRetryButton
						bookingId={bookingId}
						clientDrivePermissions={clientDrivePermissions}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
