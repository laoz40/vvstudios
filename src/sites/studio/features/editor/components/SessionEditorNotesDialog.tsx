import { useMutation } from "convex/react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { SessionNotesDialog } from "#studio/features/session-notes/components/SessionNotesDialog";

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

	return (
		<SessionNotesDialog
			bookingId={bookingId}
			open={open}
			savedNotes={savedNotes}
			onOpenChange={onOpenChange}
			fieldIdPrefix="session-editor-notes"
			title="Write editor notes"
			description={
				<>
					Write any notes about editing {bookingName}&lsquo;s session. These notes will not be sent
					to the client.
				</>
			}
			fieldLabel="Editor notes"
			saveErrorMessage="Unable to save editor notes for this session."
			saveSuccessMessage="Editor notes saved."
			onSave={(notes) => updateSessionNotes({ bookingId, editorNotes: notes })}
		/>
	);
}
