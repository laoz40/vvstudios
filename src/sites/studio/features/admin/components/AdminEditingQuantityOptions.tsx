import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { cn } from "#/lib/utils";
import {
	DELIVERABLE_COUNT_OPTIONS,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

type AdminEditingQuantityOptionsProps = {
	disabled: boolean;
	idPrefix: string;
	label: string;
	onChange: (value: BookingFormValues["essentialEditQuantity"]) => void;
	value: string;
};

export function AdminEditingQuantityOptions({
	disabled,
	idPrefix,
	label,
	onChange,
	value
}: AdminEditingQuantityOptionsProps) {
	return (
		<section className="grid gap-3">
			<Label>{label}</Label>
			<RadioGroup
				value={value}
				onValueChange={(nextValue) => {
					const count = DELIVERABLE_COUNT_OPTIONS.find((option) => option === nextValue);

					if (count) {
						onChange(count);
					}
				}}
				className="grid gap-3 sm:grid-cols-4">
				{DELIVERABLE_COUNT_OPTIONS.map((count) => {
					const optionId = `${idPrefix}-${count}`;

					return (
						<label
							key={count}
							htmlFor={optionId}
							className={cn(
								"flex cursor-pointer items-center gap-3",
								"p-3",
								"rounded-lg border",
								"transition-colors",
								"has-checked:border-primary has-checked:bg-primary/5"
							)}>
							<RadioGroupItem
								id={optionId}
								value={count}
								disabled={disabled}
							/>
							<span className="font-medium">{count}</span>
						</label>
					);
				})}
			</RadioGroup>
		</section>
	);
}
