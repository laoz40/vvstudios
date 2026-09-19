import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { AdminAddonLineItemRow } from "#studio/features/admin/components/AdminAddonLineItemRow";
import {
	adminAddonLineItemsFromState,
	adminAddonStateFromLineItems,
	createAdminAddonLineItemDraft,
	type AdminAddonLineItemDraft
} from "#studio/features/admin/lib/admin-addon-line-items";
import {
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

export type AdminAddonOptionsProps = {
	addons: BookingFormValues["addons"];
	disabled: boolean;
	idPrefix: string;
	onChange: (nextValues: { addons: BookingFormValues["addons"] } & BookingAddonQuantities) => void;
	showLabel?: boolean;
} & BookingAddonQuantities;

export function AdminAddonOptions({
	addons,
	disabled,
	onChange,
	showLabel = true,
	...quantityValues
}: AdminAddonOptionsProps) {
	const [lineItemDrafts, setLineItemDrafts] = useState<AdminAddonLineItemDraft[]>(() =>
		adminAddonLineItemsFromState(addons, pickBookingAddonQuantities(quantityValues))
	);

	function updateLineItemDrafts(nextDrafts: AdminAddonLineItemDraft[]) {
		setLineItemDrafts(nextDrafts);
		onChange(adminAddonStateFromLineItems(nextDrafts));
	}

	function updateLineItemDraft(lineItemId: string, update: Partial<AdminAddonLineItemDraft>) {
		updateLineItemDrafts(
			lineItemDrafts.map((draft) => (draft.id === lineItemId ? { ...draft, ...update } : draft))
		);
	}

	function addLineItemDraft() {
		updateLineItemDrafts([...lineItemDrafts, createAdminAddonLineItemDraft()]);
	}

	function removeLineItemDraft(lineItemId: string) {
		if (lineItemDrafts.length === 1) {
			return;
		}

		updateLineItemDrafts(lineItemDrafts.filter((draft) => draft.id !== lineItemId));
	}

	return (
		<section className="grid gap-2">
			{showLabel ? <Label>Add-ons</Label> : null}
			<div className="grid gap-2">
				{lineItemDrafts.map((lineItemDraft, index) => (
					<AdminAddonLineItemRow
						key={lineItemDraft.id}
						drafts={lineItemDrafts}
						draft={lineItemDraft}
						index={index}
						isDisabled={disabled}
						canRemove={lineItemDrafts.length > 1}
						onChange={(update) => updateLineItemDraft(lineItemDraft.id, update)}
						onRemove={() => removeLineItemDraft(lineItemDraft.id)}
					/>
				))}
				<div className="flex justify-center">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={disabled}
						onClick={addLineItemDraft}>
						<Plus className="size-4" />
						Add item
					</Button>
				</div>
			</div>
		</section>
	);
}
