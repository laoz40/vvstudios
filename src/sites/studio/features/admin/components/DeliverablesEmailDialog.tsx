import { ExternalLink, FolderOpen, LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Input } from "#/components/ui/input";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSet,
	FieldLegend
} from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import { EDITOR_EDIT_DUE_DAYS_AFTER_SESSION } from "#studio/lib/bookingdatetime";
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
	editorDueDate: string;
	onEditorDueDateChange: (date: string) => void;
	isStatusRepair: boolean;
	hasAssignedEditor: boolean;
	onEditorNotesChange: (editorNotes: string) => void;
	onMarkAsSentAfterSendingChange: (markAsSentAfterSending: boolean) => void;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
	open: boolean;
	recipient: DeliverablesRecipient;
};

export function DeliverablesEmailDialog({
	bookingId,
	editorDueDate,
	onEditorDueDateChange,
	isStatusRepair,
	hasAssignedEditor,
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
	const sendButtonLabel = getSendButtonLabel({ isSending, isStatusRepair, markAsSentAfterSending });

	const canSend =
		deliverablesFolderUrl !== undefined &&
		!isFolderStatusLoading &&
		!isSending &&
		(markAsSentAfterSending || (editorDueDate !== "" && hasAssignedEditor));

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
				className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
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
							disabled={isSending || isStatusRepair}
						/>
					</Field>

					<DeliveryOutcomeFields
						bookingId={bookingId}
						markAsSentAfterSending={markAsSentAfterSending}
						onMarkAsSentAfterSendingChange={onMarkAsSentAfterSendingChange}
						editorDueDate={editorDueDate}
						onEditorDueDateChange={onEditorDueDateChange}
						isSending={isSending}
						isStatusRepair={isStatusRepair}
						hasAssignedEditor={hasAssignedEditor}
					/>
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

function DeliveryOutcomeFields({
	bookingId,
	markAsSentAfterSending,
	onMarkAsSentAfterSendingChange,
	editorDueDate,
	onEditorDueDateChange,
	isSending,
	isStatusRepair,
	hasAssignedEditor
}: Pick<
	DeliverablesEmailDialogProps,
	| "bookingId"
	| "markAsSentAfterSending"
	| "onMarkAsSentAfterSendingChange"
	| "editorDueDate"
	| "onEditorDueDateChange"
	| "isSending"
	| "isStatusRepair"
	| "hasAssignedEditor"
>) {
	return (
		<>
			<FieldSet disabled={isSending || isStatusRepair}>
				<FieldLegend>After sending to the client</FieldLegend>
				<RadioGroup
					value={markAsSentAfterSending ? "sent" : "keep_editing"}
					onValueChange={(value) => onMarkAsSentAfterSendingChange(value === "sent")}
					disabled={isSending || isStatusRepair}>
					<Field orientation="horizontal">
						<RadioGroupItem
							value="sent"
							id={`deliverables-sent-${bookingId}`}
							aria-describedby={`deliverables-sent-help-${bookingId}`}
						/>
						<div className="flex flex-col gap-1">
							<FieldLabel htmlFor={`deliverables-sent-${bookingId}`}>Mark as sent</FieldLabel>
							<FieldDescription id={`deliverables-sent-help-${bookingId}`}>
								Send the client email and mark this session as Sent. No further editing is assigned.
							</FieldDescription>
						</div>
					</Field>
					<Field orientation="horizontal">
						<RadioGroupItem
							value="keep_editing"
							id={`deliverables-keep-editing-${bookingId}`}
							disabled={!hasAssignedEditor}
							aria-describedby={`deliverables-keep-editing-help-${bookingId}`}
						/>
						<div className="flex flex-col gap-1">
							<FieldLabel htmlFor={`deliverables-keep-editing-${bookingId}`}>
								Keep editing another part
							</FieldLabel>
							<FieldDescription id={`deliverables-keep-editing-help-${bookingId}`}>
								Send the current deliverables to the client, reset the assignment to Not started,
								replace its due date, and resend the assignment email to the editor for the next
								part.
								{!hasAssignedEditor ? " Assign an editor first to use this option." : null}
							</FieldDescription>
						</div>
					</Field>
				</RadioGroup>
				{!markAsSentAfterSending ? (
					<Field>
						<FieldLabel htmlFor={`deliverables-due-date-${bookingId}`}>
							New editing due date
						</FieldLabel>
						<Input
							id={`deliverables-due-date-${bookingId}`}
							type="date"
							required
							value={editorDueDate}
							onChange={(event) => onEditorDueDateChange(event.target.value)}
							disabled={isSending || isStatusRepair}
							aria-describedby={`deliverables-due-date-help-${bookingId}`}
						/>
						<FieldDescription id={`deliverables-due-date-help-${bookingId}`}>
							Defaults to {EDITOR_EDIT_DUE_DAYS_AFTER_SESSION} days after assigning the next part.
							You can choose a different date. Replaces the previous due date and appears in the
							editor&apos;s assignment email. Dates use Sydney time.
						</FieldDescription>
					</Field>
				) : null}
			</FieldSet>
			{isStatusRepair ? (
				<FieldDescription>
					The client email has already been sent. Retry to finish updating the assignment. Your
					delivery option and due date are locked.
				</FieldDescription>
			) : null}
		</>
	);
}

function getSendButtonLabel({
	isSending,
	isStatusRepair,
	markAsSentAfterSending
}: Pick<DeliverablesEmailDialogProps, "isSending" | "isStatusRepair" | "markAsSentAfterSending">) {
	if (isSending) return "Sending";

	if (isStatusRepair) return "Retry assignment update";

	return markAsSentAfterSending ? "Send and mark as sent" : "Send and restart editing";
}
