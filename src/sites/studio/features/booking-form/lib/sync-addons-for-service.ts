import type { BookingFormApi } from "#studio/features/booking-form/lib/booking-form-context";
import { filterAddonsAvailableForService, type BookingService } from "#/domain/booking/catalog";
import { forEachClearedAddonQuantityField } from "#/domain/booking/addon-quantities";

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
