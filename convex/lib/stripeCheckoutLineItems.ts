import { err, ok, type Result } from "neverthrow";
import {
	getCustomerAddonDisplayLabel,
	pickBookingAddonQuantities,
	type BookingAddon,
	type BookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	ADDON_PRICES,
	BOOKING_INVOICE_CURRENCY,
	DURATION_PRICES,
	getBookingAddonQuantity
} from "#studio/features/booking-form/lib/booking-pricing";

type BookingDuration = keyof typeof DURATION_PRICES;

export type SessionCheckoutLineItem = {
	quantity: number;
	price_data: { currency: string; unit_amount: number; product_data: { name: string } };
};

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

function audToStripeUnitAmount(amount: number) {
	return Math.round(amount * 100);
}

export type BuildSessionCheckoutLineItemsInput = {
	duration: string;
	addons: readonly BookingAddon[];
} & BookingAddonQuantities;

export type BuildSessionCheckoutLineItemsError = { reason: "BOOKING_INVALID_DURATION" };

export function buildSessionCheckoutLineItems(
	input: BuildSessionCheckoutLineItemsInput
): Result<SessionCheckoutLineItem[], BuildSessionCheckoutLineItemsError> {
	if (!isBookingDuration(input.duration)) {
		return err({ reason: "BOOKING_INVALID_DURATION" });
	}

	const addonQuantities = pickBookingAddonQuantities(input);

	const lineItems: SessionCheckoutLineItem[] = [
		{
			quantity: 1,
			price_data: {
				currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
				unit_amount: audToStripeUnitAmount(DURATION_PRICES[input.duration]),
				product_data: { name: `Studio Hire (${input.duration})` }
			}
		}
	];

	for (const addon of input.addons) {
		const quantity = getBookingAddonQuantity(addon, addonQuantities);

		if (quantity <= 0) {
			continue;
		}

		lineItems.push({
			quantity,
			price_data: {
				currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
				unit_amount: audToStripeUnitAmount(ADDON_PRICES[addon]),
				product_data: { name: getCustomerAddonDisplayLabel(addon) }
			}
		});
	}

	return ok(lineItems);
}
