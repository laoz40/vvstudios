import type { BookingFormApi } from "#studio/features/booking-form/lib/booking-form-context";
import {
	filterAddonsAvailableForService,
	forEachClearedAddonQuantityField,
	type BookingService
} from "#studio/features/booking-form/lib/booking-form-model";

export function syncAddonsForService(formApi: BookingFormApi, service: BookingService | "") {
	const addons = formApi.state.values.addons;
	const availableAddons = filterAddonsAvailableForService(service, addons);

	if (availableAddons.length === addons.length) {
		return;
	}

	formApi.setFieldValue("addons", availableAddons);

	forEachClearedAddonQuantityField(availableAddons, (fieldName, value) => {
		formApi.setFieldValue(fieldName, value);
	});
}
