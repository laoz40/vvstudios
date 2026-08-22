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
	formatDriveSessionFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

type DriveStatus = "failed" | "not_created" | "incomplete" | "ready";
type ClientDrivePermissionsStatus = {
	status: DriveStatus;
	assetsEmailStatus: "failed" | "not_sent" | "pending" | "sent";
};

type SavedFolder = { name: string; url?: string };

function getDriveDescription({
	status,
	clientName,
	accountName
}: {
	status: DriveStatus | undefined;
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
	sessionFolderName
}: {
	folders: SavedFolder[];
	sessionFolderName: string;
}) {
	if (folders.length === 0) return null;

	const sessionFolder = folders.find((folder) => folder.name === "Session");
	const childFolders = folders.filter((folder) => folder.name !== "Session");

	return (
		<div className="flex flex-col gap-3">
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
					<p className="text-sm text-muted-foreground">Session: not created</p>
				)}
			</div>

			{childFolders.length > 0 ? (
				<div className="ml-3 flex flex-col gap-2 border-l pl-3">
					{childFolders.map((folder) => {
						if (!folder.url) {
							return (
								<p
									key={folder.name}
									className="text-sm text-muted-foreground">
									{folder.name}: not created
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
									{folder.name}
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
				<span>{hasFolderAccess ? "Google Drive permissions set up" : "Google Drive permissions needs attention"}</span>
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
				<span>{hasSentAssetsEmail ? "Assets email sent to client" : "Assets email not sent to client"}</span>
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
	status
}: {
	bookingId: Id<"bookings">;
	status: DriveStatus | undefined;
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
	if (isSettingUp) label = "Setting up";

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
	const clientDrivePermissions = driveStatus?.clientDrivePermissions;
	const sessionFolderName = formatDriveSessionFolderName(
		getBookingStartTimestamp(sessionDate, sessionTime)
	);
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Google Drive folders</DialogTitle>
					<DialogDescription>
						{getDriveDescription({ status: driveStatus?.status, clientName, accountName })}
					</DialogDescription>
				</DialogHeader>
				<SavedFolderLinks
					folders={savedFolders}
					sessionFolderName={sessionFolderName}
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
