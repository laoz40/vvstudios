import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch } from "#/lib/result";

type SessionEditorNotesDialogProps = {
	bookingId: Id<"bookings">;
	bookingName: string;
	savedNotes: string | undefined;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function SessionEditorNotesDialog({
	bookingId,
	bookingName,
	savedNotes,
	onOpenChange,
	open
}: SessionEditorNotesDialogProps) {
	const updateSessionNotes = useMutation(api.sessions.updateSessionNotes);
	const [notes, setNotes] = useState(savedNotes ?? "");
	const [isSaving, setIsSaving] = useState(false);

	// Reset the unsaved notes to the latest stored value whenever this dialog opens.
	useEffect(() => {
		if (open) setNotes(savedNotes ?? "");
	}, [savedNotes, open]);

	async function handleSave() {
		setIsSaving(true);
		const [error] = await tryCatch(updateSessionNotes({ bookingId, editorNotes: notes }));
		setIsSaving(false);

		if (error !== null) {
			toast.error("Unable to save editor notes for this session.");
			return;
		}

		toast.success("Editor notes saved.");
		onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSaving) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Write editor notes</DialogTitle>
					<DialogDescription>
						Write any notes about editing {bookingName}&lsquo;s session. These notes will not be
						sent to the client.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={`session-editor-notes-${bookingId}`}>Editor notes</FieldLabel>
					<Textarea
						id={`session-editor-notes-${bookingId}`}
						value={notes}
						disabled={isSaving}
						placeholder="Write anything..."
						onChange={(event) => setNotes(event.target.value)}
					/>
				</Field>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isSaving}
						onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isSaving}
						onClick={() => void handleSave()}>
						{isSaving ? (
							<LoaderCircle
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
