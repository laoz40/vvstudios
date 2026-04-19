import { useStore } from "@tanstack/react-store";
import {
	Field,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
	DURATION_OPTIONS,
	SERVICES,
	toFieldErrorObjects,
	type BookingFormValues,
} from "#/features/booking-form/lib/form-shared";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toOptionId } from "#/lib/bookingdatetime";

export function BookingRecordingSpaceDurationSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
			<formApi.Field name="service">
				{(field) => (
					<FieldSet data-field-name="service">
						<FieldLegend>Recording Space *</FieldLegend>
						<RadioGroup
							value={field.state.value}
							onValueChange={(value) => {
								field.handleChange(value as BookingFormValues["service"]);
								field.handleBlur();
							}}
							className="flex flex-wrap gap-3">
							{SERVICES.map((service) => (
								<FieldLabel
									key={service}
									className="cursor-pointer w-auto! flex-row! rounded-md border">
									<Field
										orientation="horizontal"
										className="w-auto items-center rounded-md px-3 py-2">
										<RadioGroupItem
											value={service}
											id={`service-${toOptionId(service)}`}
										/>
										<FieldTitle>{service}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</FieldSet>
				)}
			</formApi.Field>

			<formApi.Field name="duration">
				{(field) => (
					<FieldSet data-field-name="duration">
						<FieldLegend>Duration *</FieldLegend>
						<RadioGroup
							value={field.state.value}
							onValueChange={(value) => {
								field.handleChange(value as BookingFormValues["duration"]);
								field.handleBlur();
							}}
							className="flex flex-wrap gap-3">
							{DURATION_OPTIONS.map((duration) => (
								<FieldLabel
									key={duration}
									className="cursor-pointer w-auto! flex-row! rounded-md border">
									<Field
										orientation="horizontal"
										className="w-auto items-center rounded-md px-3 py-2">
										<RadioGroupItem
											value={duration}
											id={`duration-${toOptionId(duration)}`}
										/>
										<FieldTitle>{duration}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</FieldSet>
				)}
			</formApi.Field>
		</>
	);
}
