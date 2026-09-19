import { useRef } from "react";
import { Button } from "#/components/ui/button";
import TrashIcon from "#/components/ui/trash-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "#/components/ui/select";
import {
	ADDON_OPTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getAdminAddonLineItemOptions,
	getAdminAddonLineItemQuantityValue,
	isAdminAddonLineItemQuantityDisabled,
	isAdminAddonQuantity,
	type AdminAddonLineItemDraft
} from "#studio/features/admin/lib/admin-addon-line-items";

type AdminAddonLineItemRowProps = {
	drafts: AdminAddonLineItemDraft[];
	draft: AdminAddonLineItemDraft;
	index: number;
	isDisabled: boolean;
	canRemove: boolean;
	onChange: (update: Partial<AdminAddonLineItemDraft>) => void;
	onRemove: () => void;
};

function isBookingAddon(value: string): value is BookingAddon {
	return ADDON_OPTIONS.some((addon) => addon === value);
}

export function AdminAddonLineItemRow({
	drafts,
	draft,
	index,
	isDisabled,
	canRemove,
	onChange,
	onRemove
}: AdminAddonLineItemRowProps) {
	const trashIconRef = useRef<AnimatedIconHandle | null>(null);
	const addonOptions = getAdminAddonLineItemOptions(drafts, draft.id);
	const quantityDisabled = isAdminAddonLineItemQuantityDisabled(draft);
	const quantityValue = getAdminAddonLineItemQuantityValue(draft);

	return (
		<div className="grid gap-2">
			<div className="flex items-center gap-2">
				<Select
					value={draft.addon}
					disabled={isDisabled || addonOptions.length === 0}
					onValueChange={(value) => {
						if (!isBookingAddon(value)) {
							return;
						}

						onChange({
							addon: value,
							quantity: isAdminAddonLineItemQuantityDisabled({ ...draft, addon: value })
								? ""
								: draft.quantity
						});
					}}>
					<SelectTrigger
						id={`admin-addon-item-${draft.id}`}
						aria-label={`Add-on ${index + 1}`}
						className="min-w-0 flex-1">
						<SelectValue
							placeholder={addonOptions.length === 0 ? "No add-ons available" : "Select item"}
						/>
					</SelectTrigger>
					<SelectContent>
						{addonOptions.map((addon) => (
							<SelectItem
								key={addon}
								value={addon}>
								{addon}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={quantityValue}
					disabled={isDisabled || quantityDisabled}
					onValueChange={(value) => {
						if (!isAdminAddonQuantity(value)) {
							return;
						}

						onChange({ quantity: value });
					}}>
					<SelectTrigger
						id={`admin-addon-quantity-${draft.id}`}
						aria-label={`Add-on ${index + 1} quantity`}
						className="w-20">
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

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0 hover:text-destructive focus-visible:text-destructive"
					disabled={isDisabled || !canRemove}
					aria-label={`Remove add-on ${index + 1}`}
					onPointerEnter={() => trashIconRef.current?.startAnimation()}
					onPointerLeave={() => trashIconRef.current?.stopAnimation()}
					onFocus={() => trashIconRef.current?.startAnimation()}
					onBlur={() => trashIconRef.current?.stopAnimation()}
					onClick={onRemove}>
					<TrashIcon
						ref={trashIconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				</Button>
			</div>
		</div>
	);
}
