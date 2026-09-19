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
import { PreviousCustomInvoices } from "#studio/features/admin/components/PreviousCustomInvoices";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import type { Id } from "#convex/_generated/dataModel";

type LegacyCustomInvoicesDialogProps = {
	open: boolean;
	customerEmail: string;
	customerName: string;
	downloadingInvoiceId: Id<"customInvoices"> | null;
	invoices?: PreviousCustomInvoiceItem[];
	onDownload: (invoiceId: Id<"customInvoices">) => void;
	onOpenChange: (open: boolean) => void;
};

export function LegacyCustomInvoicesDialog({
	open,
	customerEmail,
	customerName,
	downloadingInvoiceId,
	invoices,
	onDownload,
	onOpenChange
}: LegacyCustomInvoicesDialogProps) {
	const isLoading = invoices === undefined;
	const hasInvoices = invoices !== undefined && invoices.length > 0;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (downloadingInvoiceId !== null && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="overflow-y-auto sm:max-w-lg"
				data-lenis-prevent
				onInteractOutside={(event) => {
					if (downloadingInvoiceId !== null) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (downloadingInvoiceId !== null) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close custom invoices dialog"
						disabled={downloadingInvoiceId !== null}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Custom invoices</DialogTitle>
				</DialogHeader>

				<SessionCustomerSummary
					bookingEmail={customerEmail}
					bookingName={customerName}
				/>

				{isLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Loading custom invoices
					</div>
				) : null}

				{!isLoading && !hasInvoices ? (
					<p className="text-sm text-muted-foreground">No custom invoices for this record.</p>
				) : null}

				{hasInvoices ? (
					<PreviousCustomInvoices
						downloadingInvoiceId={downloadingInvoiceId}
						invoices={invoices}
						onDownload={onDownload}
					/>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={downloadingInvoiceId !== null}
						onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
