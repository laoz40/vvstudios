import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { BookingCustomerSummary } from "#studio/features/admin/components/BookingCustomerSummary";

export type PackageEmailConfirmationDialogProps = {
	open: boolean;
	customerName: string;
	customerEmail: string;
	description: string;
	isSending: boolean;
	sendLabel: string;
	sendingLabel: string;
	title: string;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
};

export function PackageEmailConfirmationDialog({
	open,
	customerName,
	customerEmail,
	description,
	isSending,
	sendLabel,
	sendingLabel,
	title,
	onOpenChange,
	onSend
}: PackageEmailConfirmationDialogProps) {
	function handleOpenChange(nextOpen: boolean) {
		if (isSending && !nextOpen) {
			return;
		}

		onOpenChange(nextOpen);
	}

	function preventDismissWhileSending(event: Event) {
		if (isSending) {
			event.preventDefault();
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={handleOpenChange}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={preventDismissWhileSending}
				onEscapeKeyDown={preventDismissWhileSending}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close package email confirmation dialog"
						disabled={isSending}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<BookingCustomerSummary
					bookingName={customerName}
					bookingEmail={customerEmail}
				/>

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
						disabled={isSending}>
						{isSending ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSending ? sendingLabel : sendLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
