import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { ADDON_OPTIONS, type BookingFormValues } from "#/features/booking-form/lib/form-shared";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toOptionId } from "#/lib/bookingdatetime";

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();

	return (
		<formApi.Field name="addons">
			{(field) => (
				<FieldSet data-field-name="addons">
					<FieldLegend variant="label">Add-ons</FieldLegend>
					<FieldDescription>
						Optional extras for your session. Select any that you’d like to add.
					</FieldDescription>
					<div className="flex flex-wrap gap-3">
						{ADDON_OPTIONS.map((addon) => {
							const isChecked = field.state.value.includes(addon);

							return (
								<FieldLabel
									key={addon}
									htmlFor={`addon-${toOptionId(addon)}`}
									data-state={isChecked ? "checked" : "unchecked"}
									className="cursor-pointer w-auto! flex-row! rounded-md border">
									<Field
										orientation="horizontal"
										className="w-auto items-start rounded-md px-3 py-2">
										<input
											id={`addon-${toOptionId(addon)}`}
											type="checkbox"
											checked={isChecked}
											onChange={(event) => {
												const nextValue = event.target.checked
													? [...field.state.value, addon]
													: field.state.value.filter((value) => value !== addon);

												field.handleChange(nextValue as BookingFormValues["addons"]);
												field.handleBlur();
											}}
											className="mt-0.5 size-4 rounded-sm border border-input accent-primary"
										/>
										<FieldTitle>{addon}</FieldTitle>
									</Field>
								</FieldLabel>
							);
						})}
					</div>
				</FieldSet>
			)}
		</formApi.Field>
	);
}
