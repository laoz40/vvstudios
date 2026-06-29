import { useSelector } from "@tanstack/react-store";
import { FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { cn } from "#/lib/utils";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	BOOKING_MODES,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getCardStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";

const bookingModeOptions = [
	{
		value: BOOKING_MODES[0],
		title: "Single session",
		description: "Book one session, fast and easy."
	},
	{
		value: BOOKING_MODES[1],
		title: "Package booking",
		description: "Save with a discounted session package."
	}
] as const;

export function BookingModeSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<formApi.Field name="bookingMode">
			{(field) => (
				<FieldSet
					data-field-name="bookingMode"
					className="gap-2">
					<FieldLegend className={sectionHeadingClassName}>Booking type *</FieldLegend>
					<RadioGroup
						value={field.state.value}
						onValueChange={(value) => {
							const bookingMode = BOOKING_MODES.find((mode) => mode === value);
							if (!bookingMode) return;
							field.handleChange(bookingMode);
							field.handleBlur();

							if (bookingMode === "multi") {
								formApi.setFieldValue("date", "");
								formApi.setFieldValue("time", "");
							}
						}}
						className="grid gap-4 md:grid-cols-2">
						{bookingModeOptions.map((option) => {
							const isSelected = field.state.value === option.value;

							return (
								<div key={option.value}>
									<RadioGroupItem
										value={option.value}
										id={`booking-mode-${option.value}`}
										className="peer sr-only size-0"
									/>
									<label
										htmlFor={`booking-mode-${option.value}`}
										className={cn(
											"pressable flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-input/30",
											"p-4 shadow-lg shadow-background/25",
											"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
											"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
											transitionClassName,
											getCardStateClassName(isSelected),
											isSelected && "shadow-primary/20"
										)}>
										<div className="min-w-0 space-y-1">
											<p className="text-base font-semibold text-foreground">{option.title}</p>
											<p className="text-sm leading-snug text-muted-foreground">
												{option.description}
											</p>
										</div>
										{isSelected ? (
											<span
												className={cn(
													"inline-flex shrink-0 items-center justify-center rounded-lg border",
													"px-2.5 py-0.5 md:min-h-8 md:px-3 md:py-1",
													"text-xs font-medium tracking-wider shadow-md",
													getPillStateClassName(true)
												)}>
												SELECTED
											</span>
										) : null}
									</label>
								</div>
							);
						})}
					</RadioGroup>
					{field.state.meta.isBlurred || shouldShowFieldError ? (
						<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
					) : null}
				</FieldSet>
			)}
		</formApi.Field>
	);
}
