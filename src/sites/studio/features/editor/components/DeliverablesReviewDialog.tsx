import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import type { Doc } from "#convex/_generated/dataModel";

type DeliverablesReviewDialogProps = {
	bookingId: Doc<"bookings">["_id"];
	driveLink: string;
	clientNotes: string;
	isSubmitting: boolean;
	onDriveLinkChange: (driveLink: string) => void;
	onClientNotesChange: (clientNotes: string) => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: () => void;
	open: boolean;
};

export function DeliverablesReviewDialog({
	bookingId,
	driveLink,
	clientNotes,
	isSubmitting,
	onDriveLinkChange,
	onClientNotesChange,
	onOpenChange,
	onSubmit,
	open
}: DeliverablesReviewDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSubmitting) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close deliverables review dialog"
						disabled={isSubmitting}>
						<X />
					</Button>
				</DialogClose>
				<DialogHeader className="text-left">
					<DialogTitle>Submit Deliverables for Review</DialogTitle>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={`review-drive-link-${bookingId}`}>Google Drive link</FieldLabel>
						<Input
							id={`review-drive-link-${bookingId}`}
							type="url"
							placeholder="https://drive.google.com/drive/folders/..."
							value={driveLink}
							onChange={(event) => onDriveLinkChange(event.target.value)}
							disabled={isSubmitting}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`review-client-notes-${bookingId}`}>
							Notes to the client (optional)
						</FieldLabel>
						<Textarea
							id={`review-client-notes-${bookingId}`}
							placeholder="Add any notes for the client..."
							value={clientNotes}
							onChange={(event) => onClientNotesChange(event.target.value)}
							disabled={isSubmitting}
						/>
					</Field>
				</FieldGroup>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={onSubmit}
						disabled={isSubmitting || !driveLink.trim()}>
						{isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
						{isSubmitting ? "Submitting" : "Submit for review"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
