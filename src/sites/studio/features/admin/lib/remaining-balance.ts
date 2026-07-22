import type { Doc } from "#convex/_generated/dataModel";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";

export type RemainingBalanceSession = {
	duration: string;
	addons: string[];
	remainingBalanceAmount?: number;
};

export type RemainingBalancePaymentSession = RemainingBalanceSession & {
	status: Doc<"bookings">["status"];
	paidRemainingBalance?: boolean;
};

function getDefaultRemainingBalanceAmount(session: RemainingBalanceSession) {
	return calculateBookingInvoiceAmounts(session).totalDueAmount;
}

export function getRemainingBalanceAmount(session: RemainingBalanceSession) {
	return session.remainingBalanceAmount ?? getDefaultRemainingBalanceAmount(session);
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

export function hasUnpaidRemainingBalance(session: RemainingBalancePaymentSession) {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return false;
	}

	return session.paidRemainingBalance !== true && getRemainingBalanceAmount(session) > 0;
}

export function formatAudAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
	}).format(amount);
}
