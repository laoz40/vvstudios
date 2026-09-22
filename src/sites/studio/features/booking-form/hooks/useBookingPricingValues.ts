import { useSelector } from "@tanstack/react-store";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

export type BookingPricingFields = Pick<
	BookingFormValues,
	| "addons"
	| "bookingMode"
	| "clipsPackageQuantity"
	| "completeEditQuantity"
	| "duration"
	| "essentialEditQuantity"
	| "handcraftedClipsQuantity"
	| "packageSize"
	| "service"
>;

function getBookingPricingFields(values: BookingFormValues): BookingPricingFields {
	return {
		addons: values.addons,
		bookingMode: values.bookingMode,
		clipsPackageQuantity: values.clipsPackageQuantity,
		completeEditQuantity: values.completeEditQuantity,
		duration: values.duration,
		essentialEditQuantity: values.essentialEditQuantity,
		handcraftedClipsQuantity: values.handcraftedClipsQuantity,
		packageSize: values.packageSize,
		service: values.service
	};
}

function getBookingPricingKey(fields: BookingPricingFields): string {
	return [
		fields.bookingMode,
		fields.packageSize,
		fields.duration,
		fields.service,
		fields.addons.join("\0"),
		fields.essentialEditQuantity,
		fields.completeEditQuantity,
		fields.clipsPackageQuantity,
		fields.handcraftedClipsQuantity
	].join("|");
}

function areBookingPricingFieldsEqual(
	left: BookingPricingFields,
	right: BookingPricingFields
): boolean {
	return getBookingPricingKey(left) === getBookingPricingKey(right);
}

export function useBookingPricingValues(): BookingPricingFields {
	const formApi = useBookingFormContext();

	return useSelector(formApi.store, (state) => getBookingPricingFields(state.values), {
		compare: areBookingPricingFieldsEqual
	});
}
