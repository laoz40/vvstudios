import type { Doc } from "#convex/_generated/dataModel";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";

export type RemainingBalanceBooking = {
	duration: string;
	addons: string[];
	remainingBalanceAmount?: number;
};

export type RemainingBalancePaymentBooking = RemainingBalanceBooking & {
	status: Doc<"bookings">["status"];
	paidRemainingBalance?: boolean;
};

function getDefaultRemainingBalanceAmount(booking: RemainingBalanceBooking) {
	return calculateBookingInvoiceAmounts(booking).totalDueAmount;
}

export function getRemainingBalanceAmount(booking: RemainingBalanceBooking) {
	return booking.remainingBalanceAmount ?? getDefaultRemainingBalanceAmount(booking);
}

type RemainingBalanceAmountParseResult =
	| { status: "valid"; amount: number }
	| { status: "invalid" };

export function parseRemainingBalanceAmountDraft(draft: string): RemainingBalanceAmountParseResult {
	const trimmedDraft = draft.trim();

	if (trimmedDraft === "") {
		return { status: "invalid" };
	}

	const amount = Number(trimmedDraft);

	if (!Number.isFinite(amount) || amount < 0) {
		return { status: "invalid" };
	}

	return { status: "valid", amount };
}

export function hasUnpaidRemainingBalance(booking: RemainingBalancePaymentBooking) {
	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return false;
	}

	return booking.paidRemainingBalance !== true && getRemainingBalanceAmount(booking) > 0;
}

export function formatAudAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
	}).format(amount);
}
