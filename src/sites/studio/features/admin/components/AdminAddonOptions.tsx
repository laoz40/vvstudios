import { Checkbox } from "#/components/ui/checkbox";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";
import {
	ADDON_OPTIONS,
	getClearedAddonQuantityUpdates,
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type AdminAddonOptionsProps = {
	addons: BookingFormValues["addons"];
	disabled: boolean;
	idPrefix: string;
	onChange: (nextValues: { addons: BookingFormValues["addons"] } & BookingAddonQuantities) => void;
} & BookingAddonQuantities;

export function AdminAddonOptions({
	addons,
	disabled,
	idPrefix,
	onChange,
	...quantityValues
}: AdminAddonOptionsProps) {
	const addonQuantities = pickBookingAddonQuantities(quantityValues);

	return (
		<section className="grid gap-3">
			<Label>Add-ons</Label>
			<div className="grid gap-3">
				{ADDON_OPTIONS.map((addon) => {
					const optionId = `${idPrefix}-${toOptionId(addon)}`;
					const isChecked = addons.includes(addon);

					return (
						<label
							key={addon}
							htmlFor={optionId}
							className={cn(
								"flex cursor-pointer items-center gap-3",
								"p-3",
								"rounded-lg border",
								"transition-colors",
								"has-checked:border-primary has-checked:bg-primary/5"
							)}>
							<Checkbox
								id={optionId}
								checked={isChecked}
								disabled={disabled}
								onCheckedChange={(checked) => {
									const nextAddons = checked
										? [...addons, addon]
										: addons.filter((value) => value !== addon);

									onChange({
										addons: nextAddons,
										...addonQuantities,
										...getClearedAddonQuantityUpdates(nextAddons)
									});
								}}
							/>
							<span className="font-medium">{addon}</span>
						</label>
					);
				})}
			</div>
		</section>
	);
}
