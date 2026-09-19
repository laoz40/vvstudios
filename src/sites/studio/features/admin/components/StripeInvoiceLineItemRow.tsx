import { Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "#/components/ui/select";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import {
	buildStripeInvoiceLineItemsFromDrafts,
	getApplyToAllSessionsLabel,
	getStripeInvoiceLineItemOptions,
	getStripeInvoiceLineItemQuantityValue,
	getStripeInvoiceLineItemSelectionValue,
	isStripeInvoiceLineItemQuantityDisabled,
	parseStripeInvoiceLineItemSelection,
	type StripeInvoiceContext,
	type StripeInvoiceLineItemDraft
} from "#studio/features/admin/lib/stripe-invoice-pricing";
import { DELIVERABLE_COUNT_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";

type StripeInvoiceLineItemRowProps = {
	context: StripeInvoiceContext;
	draft: StripeInvoiceLineItemDraft;
	index: number;
	isDisabled: boolean;
	canRemove: boolean;
	onChange: (update: Partial<StripeInvoiceLineItemDraft>) => void;
	onRemove: () => void;
};

function isStripeInvoiceQuantity(
	value: string
): value is (typeof DELIVERABLE_COUNT_OPTIONS)[number] {
	return DELIVERABLE_COUNT_OPTIONS.some((quantity) => quantity === value);
}

function getLineItemAmount(draft: StripeInvoiceLineItemDraft, context: StripeInvoiceContext) {
	const lineItems = buildStripeInvoiceLineItemsFromDrafts([draft], context);

	return lineItems?.[0]?.amount ?? null;
}

export function StripeInvoiceLineItemRow({
	context,
	draft,
	index,
	isDisabled,
	canRemove,
	onChange,
	onRemove
}: StripeInvoiceLineItemRowProps) {
	const lineItemOptions = getStripeInvoiceLineItemOptions(context);
	const selectionValue = getStripeInvoiceLineItemSelectionValue(draft);
	const lineItemAmount = getLineItemAmount(draft, context);

	const quantityDisabled = isStripeInvoiceLineItemQuantityDisabled(draft);
	const quantityValue = getStripeInvoiceLineItemQuantityValue(draft);

	const showApplyToEverySession =
		context.sessionCount > 1 &&
		((draft.kind === "duration_upgrade" && draft.newDuration !== "") ||
			(draft.kind === "addon" && draft.addon !== ""));

	return (
		<div className="grid gap-2 p-3">
			<div className="flex items-center gap-2">
				<Select
					value={selectionValue}
					disabled={isDisabled || lineItemOptions.length === 0}
					onValueChange={(value) => {
						const selection = parseStripeInvoiceLineItemSelection(value);

						if (selection === null) {
							return;
						}

						onChange(selection);
					}}>
					<SelectTrigger
						id={`stripe-invoice-item-${draft.id}`}
						aria-label={`Line ${index + 1} item`}
						className="min-w-0 flex-1">
						<SelectValue
							placeholder={
								lineItemOptions.length === 0 ? "No invoice items available" : "Select item"
							}
						/>
					</SelectTrigger>
					<SelectContent>
						{lineItemOptions.map((option) => (
							<SelectItem
								key={option.value}
								value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={quantityValue}
					disabled={isDisabled || quantityDisabled}
					onValueChange={(value) => {
						if (!isStripeInvoiceQuantity(value)) {
							return;
						}

						onChange({ quantity: value });
					}}>
					<SelectTrigger
						id={`stripe-invoice-quantity-${draft.id}`}
						aria-label={`Line ${index + 1} quantity`}
						className="w-16">
						<SelectValue placeholder="Qty" />
					</SelectTrigger>
					<SelectContent>
						{DELIVERABLE_COUNT_OPTIONS.map((quantity) => (
							<SelectItem
								key={quantity}
								value={quantity}>
								{quantity}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">
					{lineItemAmount === null ? "—" : formatAudAmount(lineItemAmount)}
				</span>

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0"
					disabled={isDisabled || !canRemove}
					aria-label={`Remove line item ${index + 1}`}
					onClick={onRemove}>
					<Trash2 className="size-4" />
				</Button>
			</div>

			{showApplyToEverySession ? (
				<div className="flex items-center gap-2">
					<Checkbox
						id={`stripe-invoice-apply-${draft.id}`}
						className="size-5"
						checked={draft.applyToEverySession}
						disabled={isDisabled}
						onCheckedChange={(checked) => onChange({ applyToEverySession: checked === true })}
					/>
					<Label
						htmlFor={`stripe-invoice-apply-${draft.id}`}
						className="text-sm font-normal">
						{getApplyToAllSessionsLabel(context.sessionCount)}
					</Label>
				</div>
			) : null}
		</div>
	);
}
