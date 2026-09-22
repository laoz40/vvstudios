import { useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { StripeInvoiceLineItemRow } from "#studio/features/admin/components/StripeInvoiceLineItemRow";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import type { ParsedStripeInvoiceLineItem } from "#studio/features/admin/lib/stripe-invoice-line-items";
import {
	buildStripeInvoiceLineItemsFromDrafts,
	createStripeInvoiceLineItemDraft,
	sumStripeInvoiceLineItemDrafts,
	type StripeInvoiceContext,
	type StripeInvoiceLineItemDraft
} from "#studio/features/admin/lib/stripe-invoice-pricing";

type StripeInvoiceDialogProps = {
	open: boolean;
	customerEmail: string;
	customerName: string;
	hasStripeCustomer: boolean;
	invoiceContext: StripeInvoiceContext;
	isSending: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (input: { lineItems: ParsedStripeInvoiceLineItem[]; requestId: string }) => Promise<void>;
};

type StripeInvoiceDialogFormProps = {
	customerEmail: string;
	customerName: string;
	hasStripeCustomer: boolean;
	invoiceContext: StripeInvoiceContext;
	isSending: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (input: { lineItems: ParsedStripeInvoiceLineItem[]; requestId: string }) => Promise<void>;
};

function StripeInvoiceDialogForm({
	customerEmail,
	customerName,
	hasStripeCustomer,
	invoiceContext,
	isSending,
	onOpenChange,
	onSend
}: StripeInvoiceDialogFormProps) {
	const [lineItemDrafts, setLineItemDrafts] = useState<StripeInvoiceLineItemDraft[]>([
		createStripeInvoiceLineItemDraft()
	]);

	const totalAmount = sumStripeInvoiceLineItemDrafts(lineItemDrafts, invoiceContext);
	const canSubmit = hasStripeCustomer && totalAmount !== null && totalAmount > 0 && !isSending;

	function updateLineItemDraft(lineItemId: string, update: Partial<StripeInvoiceLineItemDraft>) {
		setLineItemDrafts((currentDrafts) =>
			currentDrafts.map((draft) => (draft.id === lineItemId ? { ...draft, ...update } : draft))
		);
	}

	function addLineItemDraft() {
		setLineItemDrafts((currentDrafts) => [...currentDrafts, createStripeInvoiceLineItemDraft()]);
	}

	function removeLineItemDraft(lineItemId: string) {
		setLineItemDrafts((currentDrafts) => {
			if (currentDrafts.length === 1) {
				return [createStripeInvoiceLineItemDraft()];
			}

			return currentDrafts.filter((draft) => draft.id !== lineItemId);
		});
	}

	async function handleSendInvoice() {
		const lineItems = buildStripeInvoiceLineItemsFromDrafts(lineItemDrafts, invoiceContext);

		if (lineItems === null) {
			toast.error("Complete each item before sending the invoice.");

			return;
		}

		await onSend({ lineItems, requestId: crypto.randomUUID() });
	}

	return (
		<>
			<SessionCustomerSummary
				bookingEmail={customerEmail}
				bookingName={customerName}
			/>

			{!hasStripeCustomer ? (
				<p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
					This record has no Stripe customer ID. Stripe invoices are only available for bookings and
					packages paid through Stripe checkout.
				</p>
			) : null}

			<form
				className="grid gap-3"
				data-lenis-prevent
				onSubmit={(event) => {
					event.preventDefault();
					void handleSendInvoice();
				}}>
				<div className="grid gap-2">
					<Label>Items</Label>
					<div className="grid gap-2">
						{lineItemDrafts.map((lineItemDraft, index) => (
							<StripeInvoiceLineItemRow
								key={lineItemDraft.id}
								context={invoiceContext}
								draft={lineItemDraft}
								index={index}
								isDisabled={isSending || !hasStripeCustomer}
								canRemove
								onChange={(update) => updateLineItemDraft(lineItemDraft.id, update)}
								onRemove={() => removeLineItemDraft(lineItemDraft.id)}
							/>
						))}
						<div className="flex justify-center">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isSending || !hasStripeCustomer}
								onClick={addLineItemDraft}>
								<Plus className="size-4" />
								Add item
							</Button>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
					<span className="font-medium">Total</span>
					<span className="font-medium tabular-nums">
						{totalAmount === null ? "-" : formatAudAmount(totalAmount)}
					</span>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isSending}
						onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={!canSubmit}>
						{isSending ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSending ? "Sending" : "Send invoice"}
					</Button>
				</DialogFooter>
			</form>
		</>
	);
}

export function StripeInvoiceDialog({
	open,
	customerEmail,
	customerName,
	hasStripeCustomer,
	invoiceContext,
	isSending,
	onOpenChange,
	onSend
}: StripeInvoiceDialogProps) {
	const invoiceKey = `${customerEmail}-${invoiceContext.currentDuration}-${invoiceContext.sessionCount}`;

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
				className="overflow-y-auto sm:max-w-lg"
				data-lenis-prevent
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
						aria-label="Close Stripe invoice dialog"
						disabled={isSending}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Send Stripe invoice</DialogTitle>
				</DialogHeader>

				{open ? (
					<StripeInvoiceDialogForm
						key={invoiceKey}
						customerEmail={customerEmail}
						customerName={customerName}
						hasStripeCustomer={hasStripeCustomer}
						invoiceContext={invoiceContext}
						isSending={isSending}
						onOpenChange={onOpenChange}
						onSend={onSend}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
