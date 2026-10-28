import { useState } from "react";
import { LoaderCircle } from "lucide-react";
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
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

export function EditorSendForReviewDialog({
	session,
	isSending,
	open,
	onOpenChange,
	onSend
}: {
	session: EditorSession;
	isSending: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (deliverablesClientNotes: string) => void;
}) {
	const [notes, setNotes] = useState(session.deliverablesClientNotes ?? "");
	const notesId = `send-for-review-notes-${session._id}`;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSending) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="text-left">
					<DialogTitle>Send deliverables for review?</DialogTitle>
					<DialogDescription>
						Check every finished file is in the Deliverables folder. Sending emails the admin and
						can&apos;t be undone.
					</DialogDescription>
				</DialogHeader>

				<Field>
					<FieldLabel htmlFor={notesId}>Notes to the client (optional)</FieldLabel>
					<Textarea
						id={notesId}
						placeholder="Add any notes for the customer..."
						value={notes}
						onChange={(event) => setNotes(event.target.value)}
						disabled={isSending}
					/>				</Field>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSending}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => onSend(notes)}
						disabled={isSending}>
						{isSending ? (
							<LoaderCircle
								className="animate-spin"
								aria-hidden
							/>
						) : null}
						Send for review
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
