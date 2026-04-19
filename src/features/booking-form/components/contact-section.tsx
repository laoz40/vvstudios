import { useStore } from "@tanstack/react-store";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toFieldErrorObjects } from "#/features/booking-form/lib/form-shared";

export function BookingContactSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
			<formApi.Field name="name">
				{(field) => (
					<Field data-field-name="name">
						<FieldLabel htmlFor="name">Full Name *</FieldLabel>
						<Input
							id="name"
							type="text"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</Field>
				)}
			</formApi.Field>

			<formApi.Field name="email">
				{(field) => (
					<Field data-field-name="email">
						<FieldLabel htmlFor="email">Email *</FieldLabel>
						<Input
							id="email"
							type="email"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</Field>
				)}
			</formApi.Field>

			<formApi.Field name="notes">
				{(field) => (
					<Field data-field-name="notes">
						<FieldLabel htmlFor="notes">Notes</FieldLabel>
						<Textarea
							id="notes"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
							rows={4}
						/>
						{field.state.meta.isBlurred || shouldShowFieldError ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null}
					</Field>
				)}
			</formApi.Field>
		</>
	);
}
