import { useSelector } from "@tanstack/react-store";
import { AnimatePresence } from "motion/react";
import { BookingAddonCard } from "#studio/features/booking-form/components/BookingAddonCard";
import { BookingAddonQuantityField } from "#studio/features/booking-form/components/BookingAddonQuantityField";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import {
	isAddonAvailableForService,
	isPackageUnavailableAddon,
	isQuantityTrackedAddon,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import { toggleBookingAddon } from "#studio/features/booking-form/lib/toggle-booking-addon";

type BookingAddonOptionProps = {
	addon: BookingAddon;
	isPackageBooking: boolean;
	shouldShowFieldError: boolean;
};

export function BookingAddonOption({
	addon,
	isPackageBooking,
	shouldShowFieldError
}: BookingAddonOptionProps) {
	const formApi = useBookingFormContext();

	const isAvailable = useSelector(formApi.store, (state) =>
		isAddonAvailableForService(state.values.service, addon)
	);

	const isChecked = useSelector(formApi.store, (state) => state.values.addons.includes(addon));

	if (!isAvailable) {
		return null;
	}

	function handleCheckedChange(_selectedAddon: BookingAddon, checked: boolean) {
		toggleBookingAddon(formApi, addon, checked);
	}

	return (
		<BookingAddonCard
			addon={addon}
			checked={isChecked}
			disabled={isPackageBooking && isPackageUnavailableAddon(addon)}
			onCheckedChange={handleCheckedChange}>
			<AnimatePresence initial={false}>
				{isQuantityTrackedAddon(addon) && isChecked ? (
					<BookingAddonQuantityField
						key={addon}
						addon={addon}
						isPackageBooking={isPackageBooking}
						shouldShowFieldError={shouldShowFieldError}
					/>
				) : null}
			</AnimatePresence>
		</BookingAddonCard>
	);
}
