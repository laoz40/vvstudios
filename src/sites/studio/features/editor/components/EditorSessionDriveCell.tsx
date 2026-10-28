import { Button } from "#/components/ui/button";
import BrandGoogleIcon from "#/components/ui/brand-google-icon";
import { EditorDriveFoldersDialog } from "#studio/features/editor/components/EditorDriveFoldersDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

export function EditorSessionDriveCell({
	session,
	isDriveDialogOpen,
	onDriveDialogOpenChange
}: {
	session: EditorSession;
	isDriveDialogOpen: boolean;
	onDriveDialogOpenChange: (open: boolean) => void;
}) {
	const editStatus = session.editStatus ?? "to_edit";

	if (editStatus === "to_edit") {
		return null;
	}

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={() => onDriveDialogOpenChange(true)}>
				<BrandGoogleIcon
					size={16}
					aria-hidden
				/>
				<span className="sr-only">Google Drive folders for {session.name}</span>
			</Button>
			<EditorDriveFoldersDialog
				session={session}
				open={isDriveDialogOpen}
				onOpenChange={onDriveDialogOpenChange}
			/>
		</>
	);
}
