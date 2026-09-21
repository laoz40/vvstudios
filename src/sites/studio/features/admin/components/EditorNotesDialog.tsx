import { useState } from "react";
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

type EditorNotesDialogFormProps = { editor: ManagedEditor; onOpenChange: (open: boolean) => void };

function EditorNotesDialogForm({ editor, onOpenChange }: EditorNotesDialogFormProps) {
	const updateEmployeeNotes = useMutation(api.employees.updateEmployeeNotes);
	const [notes, setNotes] = useState(editor.notes ?? "");
	const [isSaving, setIsSaving] = useState(false);

	async function handleSave() {
		setIsSaving(true);

		const [error] = await tryCatch(
			updateEmployeeNotes({ tokenIdentifier: editor.tokenIdentifier, notes })
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
		<>
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
		</>
	);
}

export function EditorNotesDialog({ editor, onOpenChange, open }: EditorNotesDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				{open ? (
					<EditorNotesDialogForm
						key={editor.tokenIdentifier}
						editor={editor}
						onOpenChange={onOpenChange}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
