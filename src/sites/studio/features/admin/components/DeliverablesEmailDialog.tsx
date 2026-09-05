import { ExternalLink, FolderOpen, LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import type { Doc } from "#convex/_generated/dataModel";

type DeliverablesRecipient = { visibility: "shown"; email: string } | { visibility: "hidden" };

export type DeliverablesEmailDialogProps = {
	bookingId: Doc<"bookings">["_id"];
	bookingName: string;
	deliverablesFolderName: string;
	deliverablesFolderUrl: string | undefined;
	editorNotes: string;
	isFolderStatusLoading: boolean;
	isSending: boolean;
	markAsSentAfterSending: boolean;
	onEditorNotesChange: (editorNotes: string) => void;
	onMarkAsSentAfterSendingChange: (markAsSentAfterSending: boolean) => void;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
	open: boolean;
	recipient: DeliverablesRecipient;
};

export function DeliverablesEmailDialog({
	bookingId,
	bookingName,
	deliverablesFolderName,
	deliverablesFolderUrl,
	editorNotes,
	isFolderStatusLoading,
	isSending,
	onEditorNotesChange,
	onMarkAsSentAfterSendingChange,
	onOpenChange,
	onSend,
	open,
	recipient,
	markAsSentAfterSending
}: DeliverablesEmailDialogProps) {
	const sendButtonLabel = isSending ? "Sending" : "Send email";
	const canSend = deliverablesFolderUrl !== undefined && !isFolderStatusLoading && !isSending;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSending && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={(event) => {
					if (isSending) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isSending) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close deliverables email dialog"
						disabled={isSending}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Deliver deliverables</DialogTitle>
				</DialogHeader>

				{recipient.visibility === "shown" ? (
					<SessionCustomerSummary
						bookingName={bookingName}
						bookingEmail={recipient.email}
					/>
				) : null}

				<FieldGroup>
					<Field>
						<FieldLabel>Deliverables folder</FieldLabel>
						{deliverablesFolderUrl ? (
							<Button
								variant="outline"
								className="w-full justify-start"
								asChild>
								<a
									href={deliverablesFolderUrl}
									target="_blank"
									rel="noreferrer">
									<FolderOpen
										data-icon="inline-start"
										aria-hidden
									/>
									{deliverablesFolderName}
									<ExternalLink
										data-icon="inline-end"
										aria-hidden
									/>
								</a>
							</Button>
						) : (
							<p className="text-sm text-muted-foreground">
								{isFolderStatusLoading
									? "Loading the Deliverables folder."
									: "This session has no Deliverables folder yet."}
							</p>
						)}
					</Field>

					<Field>
						<FieldLabel htmlFor={`deliverables-editor-notes-${bookingId}`}>
							Notes to the client (optional)
						</FieldLabel>
						<Textarea
							id={`deliverables-editor-notes-${bookingId}`}
							placeholder="Add any notes for the customer..."
							value={editorNotes}
							onChange={(event) => onEditorNotesChange(event.target.value)}
							disabled={isSending}
						/>
					</Field>

					<Field orientation="horizontal">
						<Checkbox
							id={`deliverables-mark-sent-${bookingId}`}
							aria-describedby={`deliverables-mark-sent-description-${bookingId}`}
							checked={markAsSentAfterSending}
							onCheckedChange={(checked) => {
								onMarkAsSentAfterSendingChange(checked === true);
							}}
							disabled={isSending}
						/>
						<div className="flex flex-col gap-1">
							<FieldLabel htmlFor={`deliverables-mark-sent-${bookingId}`}>
								Mark deliverables as sent
							</FieldLabel>
							<FieldDescription id={`deliverables-mark-sent-description-${bookingId}`}>
								Updates the session status to sent after the email is sent.
							</FieldDescription>
						</div>
					</Field>
				</FieldGroup>

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
						onClick={onSend}
						disabled={!canSend}>
						{isSending ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{sendButtonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
