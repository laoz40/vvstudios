import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

export type EmailInvoiceDialogProps = {
	open: boolean;
	bookingName: string;
	bookingEmail: string;
	isSending: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
};

export function EmailInvoiceDialog({
	open,
	bookingName,
	bookingEmail,
	isSending,
	onOpenChange,
	onSend,
}: EmailInvoiceDialogProps) {
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
						aria-label="Close email invoice dialog"
						disabled={isSending}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Email invoice to customer?</DialogTitle>
					<DialogDescription>
						Confirm before sending the invoice email to this customer.
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-lg border bg-muted/40 p-4">
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Customer</dt>
							<dd className="font-medium">{bookingName}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="break-all font-medium">{bookingEmail}</dd>
						</div>
					</dl>
				</div>

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
						{isSending ? "Sending..." : "Email invoice"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
