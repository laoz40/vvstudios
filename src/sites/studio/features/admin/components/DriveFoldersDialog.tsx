import { useAction, useQuery } from "convex/react";
import { ExternalLink, Folder, FolderOpen, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
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

type DriveStatus = "not_created" | "incomplete" | "ready";

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
		case "incomplete":
			return "Google Drive folders not created completely.";
		case "not_created":
		case undefined:
			return "Google Drive folders not created.";
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
	const setupDriveFolders = useAction(api.googleCalendar.setupDrive);
	const [isSettingUp, setIsSettingUp] = useState(false);
	const driveStatus = driveResult?.[1] ?? null;
	const savedFolders = driveStatus && "folders" in driveStatus ? (driveStatus.folders ?? []) : [];
	const sessionFolderName = formatDriveSessionFolderName(
		getBookingStartTimestamp(sessionDate, sessionTime)
	);

	async function handleSetup() {
		setIsSettingUp(true);
		try {
			const [error] = await setupDriveFolders({ bookingId });
			if (error) {
				toast.error("Google Drive folders could not be created.");
				return;
			}
			toast.success("Google Drive folders created.");
		} catch {
			toast.error("Google Drive folders could not be created.");
		} finally {
			setIsSettingUp(false);
		}
	}

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
					{driveStatus?.status === "not_created" ? (
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
							{isSettingUp ? "Setting up" : "Set up Google Drive folders"}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
