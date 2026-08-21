import { useAction, useQuery } from "convex/react";
import { ExternalLink, Folder, FolderOpen, LoaderCircle } from "lucide-react";
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
						variant="secondary"
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
								variant="outline"
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
