import { LoaderCircle, X } from "lucide-react";
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
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import type { Doc } from "#convex/_generated/dataModel";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

type DeliverablesRecipient = { visibility: "shown"; email: string } | { visibility: "hidden" };

export type DeliverablesEmailDialogProps = {
	bookingId: Doc<"bookings">["_id"];
	bookingName: string;
	driveLink: string;
	editorNotes: string;
	emailVariant: DeliverablesEmailVariant;
	isSending: boolean;
	markAsSentAfterSending: boolean;
	onDriveLinkChange: (driveLink: string) => void;
	onEditorNotesChange: (editorNotes: string) => void;
	onEmailVariantChange: (emailVariant: DeliverablesEmailVariant) => void;
	onMarkAsSentAfterSendingChange: (markAsSentAfterSending: boolean) => void;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
	open: boolean;
	recipient: DeliverablesRecipient;
};

function isDeliverablesEmailVariant(value: string): value is DeliverablesEmailVariant {
	return value === "first-time" || value === "recurring";
}

export function DeliverablesEmailDialog({
	bookingId,
	bookingName,
	driveLink,
	editorNotes,
	emailVariant,
	isSending,
	markAsSentAfterSending,
	onDriveLinkChange,
	onEditorNotesChange,
	onEmailVariantChange,
	onMarkAsSentAfterSendingChange,
	onOpenChange,
	onSend,
	open,
	recipient
}: DeliverablesEmailDialogProps) {
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
					<DialogTitle>Send Deliverables Email</DialogTitle>
				</DialogHeader>

				{recipient.visibility === "shown" ? (
					<SessionCustomerSummary
						bookingName={bookingName}
						bookingEmail={recipient.email}
					/>
				) : null}

				<FieldGroup>
					<Field>
						<FieldLabel>Customer type</FieldLabel>
						<RadioGroup
							value={emailVariant}
							onValueChange={(value) => {
								if (isDeliverablesEmailVariant(value)) {
									onEmailVariantChange(value);
								}
							}}
							className="gap-2"
							disabled={isSending}>
							<FieldLabel className="w-full rounded-md border p-3">
								<RadioGroupItem value="first-time" />
								<span className="text-sm font-medium leading-5">First time customer</span>
							</FieldLabel>
							<FieldLabel className="w-full rounded-md border p-3">
								<RadioGroupItem value="recurring" />
								<span className="text-sm font-medium leading-5">Recurring customer</span>
							</FieldLabel>
						</RadioGroup>
					</Field>

					<Field>
						<FieldLabel htmlFor={`deliverables-drive-link-${bookingId}`}>
							Google Drive link
						</FieldLabel>
						<Input
							id={`deliverables-drive-link-${bookingId}`}
							type="url"
							placeholder="https://drive.google.com/drive/folders/..."
							value={driveLink}
							onChange={(event) => onDriveLinkChange(event.target.value)}
							disabled={isSending}
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor={`deliverables-editor-notes-${bookingId}`}>
							Editor notes to client (optional)
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
							checked={!markAsSentAfterSending}
							onCheckedChange={(checked) => {
								onMarkAsSentAfterSendingChange(checked !== true);
							}}
							disabled={isSending}
						/>
						<div className="flex flex-col gap-1">
							<FieldLabel htmlFor={`deliverables-mark-sent-${bookingId}`}>
								Don&apos;t set status to sent
							</FieldLabel>
							<FieldDescription>
								Check this if there are more deliverables to send later.
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
						disabled={isSending || !driveLink.trim()}>
						{isSending ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSending ? "Sending..." : "Send email"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
