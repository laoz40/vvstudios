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
import { Field, FieldDescription } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

export function EditorSendForReviewDialog({
	session,
	canSendToClient,
	isSending,
	open,
	onOpenChange,
	onSend
}: {
	session: EditorSession;
	canSendToClient: boolean;
	isSending: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (deliverablesClientNotes: string) => void;
}) {
	const [notes, setNotes] = useState(session.deliverablesClientNotes ?? "");
	const notesId = `send-for-review-notes-${session._id}`;
	const sendLabel = canSendToClient ? "Send to client" : "Send for review";

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSending) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader className="text-left">
					<DialogTitle>
						{canSendToClient ? "Send deliverables to client?" : "Send deliverables for review?"}
					</DialogTitle>
					<DialogDescription>
						Check every finished file is in the Deliverables folder.
						{canSendToClient ? null : <> This notifies the admin to review your work.</>}
					</DialogDescription>
				</DialogHeader>

				{canSendToClient ? (
					<Field>
						<Textarea
							id={notesId}
							aria-describedby={`${notesId}-guidance`}
							aria-label="Notes to the client (optional)"
							placeholder="Add a note for the customer (optional)..."
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							disabled={isSending}
						/>
						<FieldDescription
							id={`${notesId}-guidance`}
							className="text-primary">
							You&apos;re sending on behalf of VV Studios. Keep your message professional and
							consistent with the VV Studios brand.
						</FieldDescription>
					</Field>
				) : null}

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
						{isSending ? "Sending" : sendLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
