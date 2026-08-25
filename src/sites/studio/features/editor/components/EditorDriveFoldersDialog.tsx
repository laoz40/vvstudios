import { ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";
import {
	formatDriveSessionFolderName,
	formatDriveSessionMediaFolderName,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";

type DriveFolderLinkProps = { description: string | null; label: string; url: string };

function DriveFolderLink({ description, label, url }: DriveFolderLinkProps) {
	return (
		<div className="flex flex-col gap-1">
			<Button
				variant="outline"
				className="justify-start"
				asChild>
				<a
					href={url}
					target="_blank"
					rel="noreferrer">
					<FolderOpen
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
			{description === null ? null : (
				<p className="px-1 text-xs text-muted-foreground">{description}</p>
			)}
		</div>
	);
}

export function EditorDriveFoldersDialog({
	session,
	open,
	onOpenChange
}: {
	session: EditorSession;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const folders = session.driveFolders;
	const sessionStartAt = getBookingStartTimestamp(session.date, session.time);
	const clientName = session.name.trim();
	const accountName = session.accountName.trim();
	const clientLabel =
		accountName && accountName !== clientName ? `${clientName} · ${accountName}` : clientName;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Google Drive folders</DialogTitle>
					<DialogDescription>Use these folders for {clientLabel}.</DialogDescription>
				</DialogHeader>
				{folders === null ? (
					<p className="text-sm text-muted-foreground">
						Folder access is still being prepared. Ask an admin to retry permissions setup if it
						does not appear soon.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						<DriveFolderLink
							label="_Assets"
							description="The client may upload logos, brand guidelines, and other files they want in the edit."
							url={folders.assets.url}
						/>
						<DriveFolderLink
							label={formatDriveSessionFolderName(sessionStartAt)}
							description={null}
							url={folders.session.url}
						/>
						<div className="ml-3 flex flex-col gap-2 border-l pl-3">
							<DriveFolderLink
								label={formatDriveSessionMediaFolderName("Raw Media", sessionStartAt)}
								description="Download the recorded footage from here."
								url={folders.rawMedia.url}
							/>
							<DriveFolderLink
								label={formatDriveSessionMediaFolderName("Deliverables", sessionStartAt)}
								description="Upload the edited files here."
								url={folders.deliverables.url}
							/>
						</div>
					</div>
				)}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
