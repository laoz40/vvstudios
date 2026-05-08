import { useStore } from "@tanstack/react-store";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import { toFieldErrorObjects } from "#studio/features/booking-form/lib/form-shared";

const fieldSetClassName = "gap-5 md:gap-6";
const fieldStackClassName = "gap-1 md:gap-2";
const fieldNoteClassName = "-mt-0.5 italic md:-mt-1";
const sectionLegendClassName = `${sectionHeadingClassName} mb-2 md:mb-3`;
const formControlShadowClassName = "shadow-lg shadow-background/25";

const sectionCopy = {
	contactDetailsLegend: "CONTACT DETAILS",
	fullNameLabel: "Full Name *",
	fullNamePlaceholder: "Awesome Artist",
	phoneLabel: "Mobile Number *",
	phonePlaceholder: "0400 000 000",
	billingInformationLegend: "BILLING INFORMATION",
	accountNameLabel: "Account Name *",
	accountNamePlaceholder: "Account Name",
	abnLabel: "ABN",
	abnPlaceholder: "00 000 000 000",
	emailLabel: "Email *",
	emailNote: "To receive your booking invoice.",
	emailPlaceholder: "billing@example.com",
	notesLegend: "Anything else?",
	notesPlaceholder: "Let us know if you have any special requests or questions.",
} as const;

export function BookingContactSection() {
	const formApi = useBookingFormContext();
	const submissionAttempts = useStore(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;

	return (
		<>
			<FieldSet className={fieldSetClassName}>
				<FieldLegend className={sectionLegendClassName}>
					{sectionCopy.contactDetailsLegend}
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="name">
						{(field) => (
							<Field
								className={fieldStackClassName}
								data-field-name="name">
								<FieldLabel htmlFor="name">{sectionCopy.fullNameLabel}</FieldLabel>
								<Input
									id="name"
									name="name"
									type="text"
									autoComplete="name"
									placeholder={sectionCopy.fullNamePlaceholder}
									className={formControlShadowClassName}
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
							<Field
								className={fieldStackClassName}
								data-field-name="phone">
								<FieldLabel htmlFor="phone">{sectionCopy.phoneLabel}</FieldLabel>
								<Input
									id="phone"
									name="phone"
									type="tel"
									autoComplete="tel"
									inputMode="tel"
									placeholder={sectionCopy.phonePlaceholder}
									className={formControlShadowClassName}
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

			<FieldSet className={fieldSetClassName}>
				<FieldLegend className={sectionLegendClassName}>
					{sectionCopy.billingInformationLegend}
				</FieldLegend>
				<div className="grid gap-4 md:grid-cols-2">
					<formApi.Field name="accountName">
						{(field) => (
							<Field
								className={fieldStackClassName}
								data-field-name="accountName">
								<FieldLabel htmlFor="accountName">{sectionCopy.accountNameLabel}</FieldLabel>
								<Input
									id="accountName"
									name="accountName"
									type="text"
									autoComplete="organization"
									placeholder={sectionCopy.accountNamePlaceholder}
									className={formControlShadowClassName}
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
							<Field
								className={fieldStackClassName}
								data-field-name="abn">
								<FieldLabel htmlFor="abn">{sectionCopy.abnLabel}</FieldLabel>
								<Input
									id="abn"
									name="abn"
									type="text"
									autoComplete="off"
									inputMode="numeric"
									spellCheck={false}
									placeholder={sectionCopy.abnPlaceholder}
									className={formControlShadowClassName}
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
								className={fieldStackClassName}
								data-field-name="email">
								<FieldLabel htmlFor="email">{sectionCopy.emailLabel}</FieldLabel>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									spellCheck={false}
									placeholder={sectionCopy.emailPlaceholder}
									className={formControlShadowClassName}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
								/>
								<FieldDescription className={fieldNoteClassName}>
									{sectionCopy.emailNote}
								</FieldDescription>
								{field.state.meta.isBlurred || shouldShowFieldError ? (
									<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
								) : null}
							</Field>
						)}
					</formApi.Field>
				</div>
			</FieldSet>

			<FieldSet className={fieldSetClassName}>
				<FieldLegend className={sectionLegendClassName}>{sectionCopy.notesLegend}</FieldLegend>
				<formApi.Field name="notes">
					{(field) => (
						<Field
							className={fieldStackClassName}
							data-field-name="notes">
							<FieldLabel
								htmlFor="notes"
								className="sr-only">
								{sectionCopy.notesLegend}
							</FieldLabel>
							<Textarea
								id="notes"
								name="notes"
								autoComplete="off"
								value={field.state.value}
								placeholder={sectionCopy.notesPlaceholder}
								className={formControlShadowClassName}
								maxLength={200}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								rows={2}
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
