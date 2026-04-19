import { useStore } from "@tanstack/react-store";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "#/components/ui/field";
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
			<FieldSet>
				<FieldLegend className="text-sm font-semibold uppercase tracking-wide text-primary">
					Enter contact details
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="name">
						{(field) => (
							<Field data-field-name="name">
								<FieldLabel htmlFor="name">Full Name *</FieldLabel>
								<Input
									id="name"
									type="text"
									placeholder="Awesome Artist"
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

					<formApi.Field name="phone">
						{(field) => (
							<Field data-field-name="phone">
								<FieldLabel htmlFor="phone">Contact Phone Number *</FieldLabel>
								<Input
									id="phone"
									type="tel"
									placeholder="0400 000 000"
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
				</div>
			</FieldSet>

			<FieldSet>
				<FieldLegend className="text-sm font-semibold uppercase tracking-wide text-primary">
					Enter billing information
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="accountName">
						{(field) => (
							<Field data-field-name="accountName">
								<FieldLabel htmlFor="accountName">Account Name *</FieldLabel>
								<Input
									id="accountName"
									type="text"
									placeholder="Account Name"
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

					<formApi.Field name="abn">
						{(field) => (
							<Field data-field-name="abn">
								<FieldLabel htmlFor="abn">ABN</FieldLabel>
								<Input
									id="abn"
									type="text"
									placeholder="00 000 000 000"
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
							<Field
								data-field-name="email"
								className="md:col-span-2">
								<FieldLabel htmlFor="email">Email (to receive your invoice) *</FieldLabel>
								<Input
									id="email"
									type="email"
									placeholder="billing@example.com"
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
				</div>
			</FieldSet>

			<FieldSet>
				<FieldLegend className="text-sm font-semibold uppercase tracking-wide text-primary">
					Anything else?
				</FieldLegend>
				<formApi.Field name="notes">
					{(field) => (
						<Field data-field-name="notes">
							<Textarea
								id="notes"
								value={field.state.value}
								placeholder="Let us know if you have any special requests or questions."
								maxLength={200}
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
			</FieldSet>
		</>
	);
}
