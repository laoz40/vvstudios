import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import PenIcon from "#/components/ui/pen-icon";
import BrandGoogleIcon from "#/components/ui/brand-google-icon";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { SessionEditorNotesDialog } from "#studio/features/editor/components/SessionEditorNotesDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";
import { EditorDriveFoldersDialog } from "#studio/features/editor/components/EditorDriveFoldersDialog";

type DeliverablesDialogState = { status: "closed" } | { status: "drive" } | { status: "notes" };

export function EditorDeliverablesActions({ session }: { session: EditorSession }) {
	const [dialog, setDialog] = useState<DeliverablesDialogState>({ status: "closed" });

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm">
						<Ellipsis aria-hidden />
						<span className="sr-only">Open deliverables actions for {session.name}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<AnimatedDropdownMenuItem
							onSelect={() => setDialog({ status: "drive" })}
							renderIcon={(iconRef) => (
								<BrandGoogleIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Google Drive folders
						</AnimatedDropdownMenuItem>
						<AnimatedDropdownMenuItem
							className="hover:[&_svg]:text-accent-foreground focus:[&_svg]:text-accent-foreground"
							onSelect={() => setDialog({ status: "notes" })}
							renderIcon={(iconRef) => (
								<PenIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Write editor notes
						</AnimatedDropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<EditorDriveFoldersDialog
				session={session}
				open={dialog.status === "drive"}
				onOpenChange={(open) => setDialog({ status: open ? "drive" : "closed" })}
			/>
			{dialog.status === "notes" ? (
				<SessionEditorNotesDialog
					bookingId={session._id}
					bookingName={session.name}
					savedNotes={session.editorNotes}
					open
					onOpenChange={(open) => {
						if (!open) setDialog({ status: "closed" });
					}}
				/>
			) : null}
		</>
	);
}
