import { useCallback, useEffect, useState } from "react";
import type { BookingFormApi } from "#studio/features/booking-form/lib/booking-form-context";
import {
	isPackageUnavailableAddon,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getStoredSavedBookingInfo,
	removeStoredSavedBookingInfo,
	storeSavedBookingInfo,
	toSavedBookingInfo,
	type SavedBookingInfo
} from "#studio/features/booking-form/lib/saved-booking-info";

type UseSavedBookingInfoParams = { formApi: BookingFormApi; onReuseSavedBookingInfo: () => void };

export function useSavedBookingInfo({
	formApi,
	onReuseSavedBookingInfo
}: UseSavedBookingInfoParams) {
	const [savedBookingInfo, setSavedBookingInfo] = useState<SavedBookingInfo | null>(null);
	const [shouldSaveBookingInfo, setShouldSaveBookingInfo] = useState(false);

	// Load saved booking info from local storage.
	useEffect(() => {
		const nextSavedBookingInfo = getStoredSavedBookingInfo();

		if (!nextSavedBookingInfo) {
			removeStoredSavedBookingInfo();
			return;
		}

		setSavedBookingInfo(nextSavedBookingInfo);
		setShouldSaveBookingInfo(true);
	}, []);

	const persistBookingInfoFromForm = useCallback(
		(parsedValue: BookingFormValues) => {
			if (shouldSaveBookingInfo) {
				const nextSavedBookingInfo = toSavedBookingInfo(parsedValue);
				storeSavedBookingInfo(nextSavedBookingInfo);
				setSavedBookingInfo(nextSavedBookingInfo);
				return;
			}

			removeStoredSavedBookingInfo();
			setSavedBookingInfo(null);
		},
		[shouldSaveBookingInfo]
	);

	const handleReuseSavedBookingInfo = useCallback(() => {
		if (!savedBookingInfo) {
			return;
		}

		formApi.setFieldValue("bookingMode", savedBookingInfo.bookingMode);
		formApi.setFieldValue("packageSize", savedBookingInfo.packageSize);
		formApi.setFieldValue(
			"service",
			savedBookingInfo.bookingMode === "multi" ? "" : savedBookingInfo.service
		);
		formApi.setFieldValue("duration", savedBookingInfo.duration);
		formApi.setFieldValue(
			"addons",
			savedBookingInfo.bookingMode === "multi"
				? savedBookingInfo.addons.filter((addon) => !isPackageUnavailableAddon(addon))
				: [...savedBookingInfo.addons]
		);
		formApi.setFieldValue("essentialEditQuantity", savedBookingInfo.essentialEditQuantity);
		formApi.setFieldValue("completeEditQuantity", savedBookingInfo.completeEditQuantity);
		formApi.setFieldValue("clipsPackageQuantity", savedBookingInfo.clipsPackageQuantity);
		formApi.setFieldValue("handcraftedClipsQuantity", savedBookingInfo.handcraftedClipsQuantity);
		formApi.setFieldValue("name", savedBookingInfo.name);
		formApi.setFieldValue("phone", savedBookingInfo.phone);
		formApi.setFieldValue("accountName", savedBookingInfo.accountName);
		formApi.setFieldValue("abn", savedBookingInfo.abn);
		formApi.setFieldValue("email", savedBookingInfo.email);
		formApi.setFieldValue(
			"notes",
			savedBookingInfo.bookingMode === "single" ? savedBookingInfo.notes : ""
		);
		onReuseSavedBookingInfo();
	}, [formApi, onReuseSavedBookingInfo, savedBookingInfo]);

	const handleRemoveSavedBookingInfo = useCallback(() => {
		removeStoredSavedBookingInfo();
		setSavedBookingInfo(null);
		setShouldSaveBookingInfo(false);
	}, []);

	const handleSaveBookingInfoChange = useCallback((checked: boolean) => {
		setShouldSaveBookingInfo(checked);

		if (!checked) {
			removeStoredSavedBookingInfo();
			setSavedBookingInfo(null);
		}
	}, []);

	return {
		handleRemoveSavedBookingInfo,
		handleReuseSavedBookingInfo,
		handleSaveBookingInfoChange,
		persistBookingInfoFromForm,
		savedBookingInfo,
		shouldSaveBookingInfo
	};
}
