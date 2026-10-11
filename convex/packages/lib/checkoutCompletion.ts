import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import type { PaidPackageResult } from "#convex/packages/lib/payment";

export type ClaimedCheckoutEmailContext = {
	bookingSettings: BookingAvailabilitySettings;
	checkoutReturnOrigin: string;
	paymentResult: PaidPackageResult;
};

export function checkoutReturnOrigin(checkoutReturnUrl: string) {
	return new URL(checkoutReturnUrl).origin;
}

export function bookingSettingsWithCheckoutOrigin(
	bookingSettings: BookingAvailabilitySettings,
	checkoutReturnUrl: string
) {
	return { bookingSettings, checkoutReturnOrigin: checkoutReturnOrigin(checkoutReturnUrl) };
}
