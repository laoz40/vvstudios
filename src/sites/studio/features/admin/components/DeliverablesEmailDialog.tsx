import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { BookingCustomerSummary } from "#studio/features/admin/components/BookingCustomerSummary";
import type { Doc } from "#convex/_generated/dataModel";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";

export type DeliverablesEmailDialogProps = {
	bookingEmail: string;
	bookingId: Doc<"bookings">["_id"];
	bookingName: string;
	driveLink: string;
	emailVariant: DeliverablesEmailVariant;
	isSending: boolean;
	onDriveLinkChange: (driveLink: string) => void;
	onEmailVariantChange: (emailVariant: DeliverablesEmailVariant) => void;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
	open: boolean;
};

export function DeliverablesEmailDialog({
	bookingEmail,
	bookingId,
	bookingName,
	driveLink,
	emailVariant,
	isSending,
	onDriveLinkChange,
	onEmailVariantChange,
	onOpenChange,
	onSend,
	open,
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

				<BookingCustomerSummary
					bookingName={bookingName}
					bookingEmail={bookingEmail}
				/>

				<FieldGroup>
					<Field>
						<FieldLabel>Customer type</FieldLabel>
						<RadioGroup
							value={emailVariant}
							onValueChange={(value) => onEmailVariantChange(value as DeliverablesEmailVariant)}
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
