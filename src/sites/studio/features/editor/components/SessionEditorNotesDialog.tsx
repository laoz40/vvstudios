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
	const updateSessionNotes = useMutation(api.sessions.admin.updateSessionNotes);

	return (
		<SessionNotesDialog
			bookingId={bookingId}
			open={open}
			savedNotes={savedNotes}
			onOpenChange={onOpenChange}
			fieldIdPrefix="session-editor-notes"
			title="Notes for admin"
			fieldLabel="Notes"
			description={
				<>Share updates or context with the admin about editing {bookingName}&apos;s session.</>
			}
			notificationMessage="Saving new or changed notes emails the admin."
			saveErrorMessage="Unable to save your notes for the admin."
			saveSuccessMessage="Notes for admin saved."
			onSave={(notes) => updateSessionNotes({ bookingId, editorNotes: notes })}
		/>
	);
}
