import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";

export type RemainingBalanceBooking = {
	duration: string;
	addons: string[];
	remainingBalanceAmount?: number;
};

export function getDefaultRemainingBalanceAmount(booking: RemainingBalanceBooking) {
	return calculateBookingInvoiceAmounts(booking).totalDueAmount;
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
