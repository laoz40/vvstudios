import { useState } from "react";
import { Button } from "#/components/ui/button";
import BrandGoogleIcon from "#/components/ui/brand-google-icon";
import { EditorDriveFoldersDialog } from "#studio/features/editor/components/EditorDriveFoldersDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

export function EditorSessionDriveCell({ session }: { session: EditorSession }) {
	const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={() => setIsDriveDialogOpen(true)}>
				<BrandGoogleIcon
					size={16}
					aria-hidden
				/>
				<span className="sr-only">Google Drive folders for {session.name}</span>
			</Button>
			<EditorDriveFoldersDialog
				session={session}
				open={isDriveDialogOpen}
				onOpenChange={setIsDriveDialogOpen}
			/>
		</>
	);
}
