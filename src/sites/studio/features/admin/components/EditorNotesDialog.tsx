import { useEffect, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import {
	getEditorAccessErrorMessage,
	type ManagedEditor
} from "#studio/features/admin/lib/editor-management";

type EditorNotesDialogProps = {
	editor: ManagedEditor;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function EditorNotesDialog({ editor, onOpenChange, open }: EditorNotesDialogProps) {
	const updateEditorNotes = useMutation(api.editors.updateEditorNotes);
	const [notes, setNotes] = useState(editor.notes ?? "");
	const [isSaving, setIsSaving] = useState(false);

	// Reset the draft whenever an editor's notes dialog opens.
	useEffect(() => {
		if (open) setNotes(editor.notes ?? "");
	}, [editor.notes, editor.tokenIdentifier, open]);

	async function handleSave() {
		setIsSaving(true);
		const [error] = await tryCatch(
			updateEditorNotes({ tokenIdentifier: editor.tokenIdentifier, notes })
		);
		setIsSaving(false);

		if (error !== null) {
			toast.error(getEditorAccessErrorMessage(error.reason));
			return;
		}

		toast.success("Editor notes saved");
		onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit notes</DialogTitle>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor="editor-notes">
						Notes for {editor.displayName || editor.email}.
					</FieldLabel>
					<Textarea
						id="editor-notes"
						value={notes}
						disabled={isSaving}
						onChange={(event) => setNotes(event.target.value)}
					/>
				</Field>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							variant="outline"
							disabled={isSaving}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						disabled={isSaving}
						onClick={() => void handleSave()}>
						{isSaving ? (
							<LoaderCircleIcon
								data-icon="inline-start"
								className="animate-spin"
							/>
						) : null}
						{isSaving ? "Saving" : "Save notes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
