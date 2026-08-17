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

type SessionAdminNotesDialogProps = {
	bookingId: Id<"bookings">;
	bookingName: string;
	savedNotes: string | undefined;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function SessionAdminNotesDialog({
	bookingId,
	bookingName,
	savedNotes,
	onOpenChange,
	open
}: SessionAdminNotesDialogProps) {
	const updateSessionAdminNotes = useMutation(api.sessions.updateSessionAdminNotes);
	const [notes, setNotes] = useState(savedNotes ?? "");
	const [isSaving, setIsSaving] = useState(false);

	// Reset the unsaved notes to the latest stored value whenever this dialog opens.
	useEffect(() => {
		if (open) setNotes(savedNotes ?? "");
	}, [savedNotes, open]);

	async function handleSave() {
		setIsSaving(true);
		const [error] = await tryCatch(updateSessionAdminNotes({ bookingId, adminNotes: notes }));
		setIsSaving(false);

		if (error !== null) {
			toast.error("Unable to save admin notes for this session.");
			return;
		}

		toast.success("Admin notes saved.");
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
					<DialogTitle>Write admin notes</DialogTitle>
					<DialogDescription>
						Add instructions for the editor working on {bookingName}&lsquo;s session. These notes
						will not be sent to the client.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={`session-admin-notes-${bookingId}`}>Admin notes</FieldLabel>
					<Textarea
						id={`session-admin-notes-${bookingId}`}
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
