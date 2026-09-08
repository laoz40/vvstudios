import { useMutation } from "convex/react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { SessionNotesDialog } from "#studio/features/session-notes/components/SessionNotesDialog";

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

	return (
		<SessionNotesDialog
			bookingId={bookingId}
			open={open}
			savedNotes={savedNotes}
			onOpenChange={onOpenChange}
			fieldIdPrefix="session-admin-notes"
			title="Write admin notes"
			description={
				<>
					Add instructions for the editor working on {bookingName}&lsquo;s session. These notes will
					not be sent to the client.
				</>
			}
			fieldLabel="Admin notes"
			saveErrorMessage="Unable to save admin notes for this session."
			saveSuccessMessage="Admin notes saved."
			onSave={(notes) => updateSessionAdminNotes({ bookingId, adminNotes: notes })}
		/>
	);
}
