import { format } from "date-fns";
import { LoaderCircle, X } from "lucide-react";
import type { Doc, Id } from "#convex/_generated/dataModel";
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
import { Field, FieldLabel } from "#/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "#/components/ui/select";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import { formatCustomInvoiceTotal } from "#studio/features/admin/lib/custom-invoices";

export type EmailInvoiceDialogProps = {
	open: boolean;
	bookingName: string;
	bookingEmail: string;
	customInvoices?: Doc<"customInvoices">[];
	isSending: boolean;
	selectedCustomInvoiceId: Id<"customInvoices"> | null;
	onOpenChange: (open: boolean) => void;
	onSelectedCustomInvoiceIdChange: (customInvoiceId: Id<"customInvoices"> | null) => void;
	onSend: () => void;
};

export function EmailInvoiceDialog({
	open,
	bookingName,
	bookingEmail,
	customInvoices,
	isSending,
	selectedCustomInvoiceId,
	onOpenChange,
	onSelectedCustomInvoiceIdChange,
	onSend
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
						Choose an invoice, then confirm the email to this customer.
					</DialogDescription>
				</DialogHeader>

				<SessionCustomerSummary
					bookingName={bookingName}
					bookingEmail={bookingEmail}
				/>

				<Field>
					<FieldLabel htmlFor="invoice-email-selection">Invoice</FieldLabel>
					<Select
						value={selectedCustomInvoiceId ?? "original"}
						disabled={isSending || customInvoices === undefined}
						onValueChange={(value) =>
							onSelectedCustomInvoiceIdChange(
								value === "original" ? null : (value as Id<"customInvoices">)
							)
						}>
						<SelectTrigger
							id="invoice-email-selection"
							className="w-full">
							<SelectValue placeholder="Loading invoices" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="original">Original booking invoice</SelectItem>
								{customInvoices?.map((invoice) => (
									<SelectItem
										key={invoice._id}
										value={invoice._id}>
										{invoice.invoiceNumber} —{" "}
										{formatCustomInvoiceTotal({
											service: invoice.service,
											addons: invoice.addons,
											duration: invoice.duration ?? "",
											includeDepositLineItem: invoice.includeDepositLineItem,
											essentialEditQuantity: invoice.essentialEditQuantity,
											clipsPackageQuantity: invoice.clipsPackageQuantity,
											customTotalDueAmount: invoice.customTotalDueAmount
										})}{" "}
										— {format(invoice.createdAt, "d MMM yyyy")}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>

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
						disabled={isSending || customInvoices === undefined}>
						{isSending ? <LoaderCircle className="animate-spin" /> : null}
						{isSending ? "Sending" : "Email invoice"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
