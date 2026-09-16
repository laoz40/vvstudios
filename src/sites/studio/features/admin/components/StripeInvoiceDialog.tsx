import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
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
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import {
	createStripeInvoiceLineItemDraft,
	parseStripeInvoiceLineItemDrafts,
	sumStripeInvoiceLineItemDrafts,
	type ParsedStripeInvoiceLineItem,
	type StripeInvoiceLineItemDraft
} from "#studio/features/admin/lib/stripe-invoice-line-items";

type StripeInvoiceDialogProps = {
	open: boolean;
	customerEmail: string;
	customerName: string;
	hasStripeCustomer: boolean;
	isSending: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (input: { lineItems: ParsedStripeInvoiceLineItem[]; requestId: string }) => Promise<void>;
};

export function StripeInvoiceDialog({
	open,
	customerEmail,
	customerName,
	hasStripeCustomer,
	isSending,
	onOpenChange,
	onSend
}: StripeInvoiceDialogProps) {
	const [lineItemDrafts, setLineItemDrafts] = useState<StripeInvoiceLineItemDraft[]>([
		createStripeInvoiceLineItemDraft()
	]);

	// Reset line items each time the dialog opens.
	useEffect(() => {
		if (open) {
			setLineItemDrafts([createStripeInvoiceLineItemDraft()]);
		}
	}, [open]);

	const totalAmount = sumStripeInvoiceLineItemDrafts(lineItemDrafts);
	const canSubmit = hasStripeCustomer && totalAmount !== null && !isSending;

	function updateLineItemDraft(
		lineItemId: string,
		update: Partial<Pick<StripeInvoiceLineItemDraft, "amount" | "description">>
	) {
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
				return currentDrafts;
			}

			return currentDrafts.filter((draft) => draft.id !== lineItemId);
		});
	}

	async function handleSendInvoice() {
		const lineItems = parseStripeInvoiceLineItemDrafts(lineItemDrafts);

		if (lineItems === null) {
			toast.error("Add at least one line item with a description and amount greater than zero.");

			return;
		}

		await onSend({ lineItems, requestId: crypto.randomUUID() });
	}

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

				<SessionCustomerSummary
					bookingEmail={customerEmail}
					bookingName={customerName}
				/>

				{!hasStripeCustomer ? (
					<p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
						This record has no Stripe customer ID. Stripe invoices are only available for bookings
						and packages paid through Stripe checkout.
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
						<Label>Line items</Label>
						<div className="grid gap-2 text-sm">
							<div className="flex items-center gap-2 px-1 text-muted-foreground">
								<span className="min-w-0 flex-1">Description</span>
								<span className="w-20 text-right">Amount</span>
								<span className="size-8 shrink-0" />
							</div>
							{lineItemDrafts.map((lineItemDraft, index) => (
								<div
									key={lineItemDraft.id}
									className="flex items-center gap-2">
									<Input
										id={`stripe-invoice-description-${lineItemDraft.id}`}
										aria-label={`Line ${index + 1} description`}
										className="min-w-0 flex-1"
										value={lineItemDraft.description}
										disabled={isSending || !hasStripeCustomer}
										placeholder="Extra editing hours"
										onChange={(event) =>
											updateLineItemDraft(lineItemDraft.id, { description: event.target.value })
										}
									/>
									<Input
										id={`stripe-invoice-amount-${lineItemDraft.id}`}
										aria-label={`Line ${index + 1} amount`}
										className="w-20 text-right tabular-nums"
										inputMode="decimal"
										value={lineItemDraft.amount}
										disabled={isSending || !hasStripeCustomer}
										placeholder="0"
										onChange={(event) =>
											updateLineItemDraft(lineItemDraft.id, { amount: event.target.value })
										}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										disabled={isSending || lineItemDrafts.length === 1}
										aria-label={`Remove line item ${index + 1}`}
										onClick={() => removeLineItemDraft(lineItemDraft.id)}>
										<Trash2 className="size-4" />
									</Button>
								</div>
							))}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-fit"
							disabled={isSending || !hasStripeCustomer}
							onClick={addLineItemDraft}>
							<Plus className="size-4" />
							Add line item
						</Button>
					</div>

					<div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
						<span className="font-medium">Total</span>
						<span className="font-medium tabular-nums">
							{totalAmount === null ? "Enter valid line items" : formatAudAmount(totalAmount)}
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
			</DialogContent>
		</Dialog>
	);
}
