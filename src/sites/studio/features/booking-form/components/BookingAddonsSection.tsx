import { useSelector } from "@tanstack/react-store";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "#/components/ui/field";
import { BookingAddonOption } from "#studio/features/booking-form/components/BookingAddonOption";
import { BookingAddonSectionDescription } from "#studio/features/booking-form/components/BookingAddonSectionDescription";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	ADDON_SECTIONS,
	bookingFieldBlurValidator,
	isAddonAvailableForService,
	toFieldErrorObjects
} from "#studio/features/booking-form/lib/booking-form-model";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";

type BookingAddonSectionProps = {
	isPackageBooking: boolean;
	section: (typeof ADDON_SECTIONS)[number];
	shouldShowFieldError: boolean;
};

function BookingAddonSection({
	isPackageBooking,
	section,
	shouldShowFieldError
}: BookingAddonSectionProps) {
	const formApi = useBookingFormContext();

	const hasVisibleAddons = useSelector(formApi.store, (state) =>
		section.addons.some((addon) => isAddonAvailableForService(state.values.service, addon))
	);

	if (!hasVisibleAddons) {
		return null;
	}

	return (
		<FieldSet>
			<FieldLegend className={sectionHeadingClassName}>{section.title}</FieldLegend>
			<FieldDescription>
				<BookingAddonSectionDescription sectionTitle={section.title} />
			</FieldDescription>
			<div className="flex flex-col gap-4">
				{section.addons.map((addon) => (
					<BookingAddonOption
						key={addon}
						addon={addon}
						isPackageBooking={isPackageBooking}
						shouldShowFieldError={shouldShowFieldError}
					/>
				))}
			</div>
		</FieldSet>
	);
}

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();
	const bookingMode = useSelector(formApi.store, (state) => state.values.bookingMode);
	const submissionAttempts = useSelector(formApi.store, (state) => state.submissionAttempts);
	const shouldShowFieldError = submissionAttempts > 0;
	const isPackageBooking = bookingMode === "package";

	return (
		<div
			data-field-name="addons"
			className="flex flex-col gap-8">
			{ADDON_SECTIONS.map((section) => (
				<BookingAddonSection
					key={section.title}
					section={section}
					isPackageBooking={isPackageBooking}
					shouldShowFieldError={shouldShowFieldError}
				/>
			))}
			{shouldShowFieldError ? (
				<formApi.Field
					name="addons"
					validators={bookingFieldBlurValidator("addons")}>
					{(field) =>
						field.state.meta.errors.length > 0 ? (
							<FieldError errors={toFieldErrorObjects(field.state.meta.errors)} />
						) : null
					}
				</formApi.Field>
			) : null}
		</div>
	);
}
