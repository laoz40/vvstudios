import { Checkbox } from "#/components/ui/checkbox";
import { Label } from "#/components/ui/label";
import {
	ADDON_OPTIONS,
	hasEditingAddon,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type AdminAddonOptionsProps = {
	addons: BookingFormValues["addons"];
	deliverableCount: BookingFormValues["deliverableCount"];
	disabled: boolean;
	idPrefix: string;
	onChange: (nextValues: {
		addons: BookingFormValues["addons"];
		deliverableCount: BookingFormValues["deliverableCount"];
	}) => void;
};

export function AdminAddonOptions({
	addons,
	deliverableCount,
	disabled,
	idPrefix,
	onChange,
}: AdminAddonOptionsProps) {
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
							className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
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
										deliverableCount: hasEditingAddon(nextAddons) ? deliverableCount : "",
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
