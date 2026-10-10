import type { Doc } from "#convex/_generated/dataModel";
import { buildAddonBillableLine, isBookingDuration } from "#/domain/booking/billable-line-items";
import { DURATION_PRICES } from "#/domain/booking/price-constants";
import { getBookingAddonQuantityForForm } from "#/domain/booking/addon-quantities";
import type { BookingAddonQuantities } from "#/domain/booking/addon-quantities";
import type { StripeInvoiceLineItem } from "#convex/stripe/lib/stripeInvoice";

type PricingValues = Pick<Doc<"bookings">, "duration" | "addons"> & BookingAddonQuantities;

export function buildEditInvoiceAdditions(args: {
	current: PricingValues;
	next: PricingValues;
	currentSessionCount: number;
	nextSessionCount: number;
	excludeRemote: boolean;
}): StripeInvoiceLineItem[] {
	const { current, next, currentSessionCount, nextSessionCount } = args;
	const lines: StripeInvoiceLineItem[] = [];
	const currentBase = isBookingDuration(current.duration) ? DURATION_PRICES[current.duration] : 0;
	const nextBase = isBookingDuration(next.duration) ? DURATION_PRICES[next.duration] : 0;
	const studioIncrease = nextBase * nextSessionCount - currentBase * currentSessionCount;

	if (studioIncrease > 0) {
		let sessions = "";

		if (currentSessionCount !== nextSessionCount) {
			sessions = ` (${currentSessionCount} → ${nextSessionCount} sessions)`;
		} else if (nextSessionCount > 1) {
			sessions = ` (${nextSessionCount} sessions)`;
		}

		const duration =
			current.duration !== next.duration ? `: ${current.duration} → ${next.duration}` : "";

		lines.push({ description: `Studio hire${sessions}${duration}`, amount: studioIncrease });
	}

	for (const addon of next.addons) {
		if (args.excludeRemote && addon === "Remote Podcast") continue;

		const previousQuantity = current.addons.includes(addon)
			? getBookingAddonQuantityForForm(addon, current) * currentSessionCount
			: 0;

		const addedQuantity =
			getBookingAddonQuantityForForm(addon, next) * nextSessionCount - previousQuantity;

		const line = buildAddonBillableLine({ sessionCount: 1 }, addon, addedQuantity, false);

		if (line) lines.push(line);
	}

	return lines;
}

export function buildEditInvoiceLineItems(
	additions: StripeInvoiceLineItem[],
	amount: number,
	description: string
): StripeInvoiceLineItem[] {
	if (amount <= 0) return [];

	if (additions.length === 0) return [{ description, amount }];

	const adjustment =
		Math.round((amount - additions.reduce((total, line) => total + line.amount, 0)) * 100) / 100;

	return adjustment === 0
		? additions
		: [
				...additions,
				{
					description: adjustment < 0 ? "Credits and pricing adjustments" : "Pricing adjustment",
					amount: adjustment
				}
			];
}
