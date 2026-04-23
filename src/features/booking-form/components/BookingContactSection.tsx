import { useStore } from "@tanstack/react-store";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toFieldErrorObjects } from "#/features/booking-form/lib/form-shared";

const sectionCopy = {
	contactDetailsLegend: "CONTACT DETAILS",
	fullNameLabel: "Full Name *",
	fullNamePlaceholder: "Awesome Artist",
	phoneLabel: "Contact Phone Number *",
	phonePlaceholder: "0400 000 000",
	billingInformationLegend: "BILLING INFORMATION",
	accountNameLabel: "Account Name *",
	accountNamePlaceholder: "Account Name",
	abnLabel: "ABN",
	abnPlaceholder: "00 000 000 000",
	emailLabel: "Email (to receive your invoice) *",
	emailPlaceholder: "billing@example.com",
	notesLegend: "Anything else?",
	notesPlaceholder: "Let us know if you have any special requests or questions.",
} as const;

export interface BookingContactSectionProps {
	sectionHeadingClassName: string;
}

export function BookingContactSection({ sectionHeadingClassName }: BookingContactSectionProps) {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
			<FieldSet>
				<FieldLegend className={sectionHeadingClassName}>
					{sectionCopy.contactDetailsLegend}
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="name">
						{(field) => (
							<Field data-field-name="name">
								<FieldLabel htmlFor="name">{sectionCopy.fullNameLabel}</FieldLabel>
								<Input
									id="name"
									type="text"
									placeholder={sectionCopy.fullNamePlaceholder}
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
								<FieldLabel htmlFor="phone">{sectionCopy.phoneLabel}</FieldLabel>
								<Input
									id="phone"
									type="tel"
									placeholder={sectionCopy.phonePlaceholder}
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
				<FieldLegend className={sectionHeadingClassName}>
					{sectionCopy.billingInformationLegend}
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="accountName">
						{(field) => (
							<Field data-field-name="accountName">
								<FieldLabel htmlFor="accountName">{sectionCopy.accountNameLabel}</FieldLabel>
								<Input
									id="accountName"
									type="text"
									placeholder={sectionCopy.accountNamePlaceholder}
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
								<FieldLabel htmlFor="abn">{sectionCopy.abnLabel}</FieldLabel>
								<Input
									id="abn"
									type="text"
									placeholder={sectionCopy.abnPlaceholder}
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
								<FieldLabel htmlFor="email">{sectionCopy.emailLabel}</FieldLabel>
								<Input
									id="email"
									type="email"
									placeholder={sectionCopy.emailPlaceholder}
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
				<FieldLegend className={sectionHeadingClassName}>{sectionCopy.notesLegend}</FieldLegend>
				<formApi.Field name="notes">
					{(field) => (
						<Field data-field-name="notes">
							<Textarea
								id="notes"
								value={field.state.value}
								placeholder={sectionCopy.notesPlaceholder}
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
