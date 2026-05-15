import { ADDON_PRICES, DURATION_PRICES } from "#studio/features/booking-invoice/lib/constants";
import type { BookingAddon, BookingDuration } from "#studio/features/booking-invoice/lib/types";

function isBookingAddon(value: string): value is BookingAddon {
	return value in ADDON_PRICES;
}

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

export type RemainingBalanceBooking = {
	duration: string;
	addons: string[];
	remainingBalanceAmount?: number;
};

export function getDefaultRemainingBalanceAmount(booking: RemainingBalanceBooking) {
	const durationAmount = isBookingDuration(booking.duration)
		? DURATION_PRICES[booking.duration]
		: 0;
	const addonsAmount = booking.addons.reduce(
		(total, addon) => total + (isBookingAddon(addon) ? ADDON_PRICES[addon] : 0),
		0,
	);

	return durationAmount + addonsAmount;
}

export function getRemainingBalanceAmount(booking: RemainingBalanceBooking) {
	return booking.remainingBalanceAmount ?? getDefaultRemainingBalanceAmount(booking);
}

export function formatAudAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
	}).format(amount);
}
