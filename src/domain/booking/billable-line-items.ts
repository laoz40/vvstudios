import {
	DURATION_OPTIONS,
	getCustomerAddonDisplayLabel,
	type BookingAddon
} from "#/domain/booking/catalog";
import { ADDON_PRICES, DURATION_PRICES, type PackageSize } from "#/domain/booking/price-constants";

type BookingDuration = (typeof DURATION_OPTIONS)[number];

export type BillableSessionScope = { sessionCount: 1 | PackageSize };

export type BillableLineItem = { amount: number; description: string };

export type PricedLineItem = BillableLineItem & { quantity: number; unitAmount: number };

function getDurationIndex(duration: BookingDuration) {
	return DURATION_OPTIONS.indexOf(duration);
}

export function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

export function getDurationUpgradePerSessionAmount(
	currentDuration: BookingDuration,
	newDuration: BookingDuration
) {
	const currentIndex = getDurationIndex(currentDuration);
	const newIndex = getDurationIndex(newDuration);

	if (newIndex <= currentIndex) {
		return null;
	}

	return DURATION_PRICES[newDuration] - DURATION_PRICES[currentDuration];
}

function billableSessionCount(scope: BillableSessionScope, applyToEverySession: boolean) {
	const appliedToEverySession = scope.sessionCount > 1 && applyToEverySession;

	return appliedToEverySession ? scope.sessionCount : 1;
}

function formatDurationUpgradeDescription(
	currentDuration: BookingDuration,
	newDuration: BookingDuration,
	options: { appliedToEverySession: boolean; sessionCount: number }
) {
	if (options.appliedToEverySession) {
		return `Studio hire upgrade (${options.sessionCount} sessions): ${currentDuration} to ${newDuration}`;
	}

	return `Studio hire upgrade: ${currentDuration} to ${newDuration}`;
}

function formatAddonBillableDescription(
	addon: BookingAddon,
	totalQuantity: number,
	options: { appliedToEverySession: boolean; sessionCount: number }
) {
	const label = getCustomerAddonDisplayLabel(addon);

	if (totalQuantity <= 1) {
		return label;
	}

	if (options.appliedToEverySession) {
		return `${label} x${totalQuantity} (${options.sessionCount} sessions)`;
	}

	return `${label} x${totalQuantity}`;
}

export function buildDurationUpgradeBillableLine(
	scope: BillableSessionScope,
	currentDuration: BookingDuration,
	newDuration: BookingDuration,
	applyToEverySession: boolean
): BillableLineItem | null {
	const perSessionAmount = getDurationUpgradePerSessionAmount(currentDuration, newDuration);

	if (perSessionAmount === null) {
		return null;
	}

	const appliedToEverySession = scope.sessionCount > 1 && applyToEverySession;
	const sessionsToBill = billableSessionCount(scope, applyToEverySession);
	const amount = perSessionAmount * sessionsToBill;

	return {
		description: formatDurationUpgradeDescription(currentDuration, newDuration, {
			appliedToEverySession,
			sessionCount: scope.sessionCount
		}),
		amount
	};
}

export function buildAddonBillableLine(
	scope: BillableSessionScope,
	addon: BookingAddon,
	quantity: number,
	applyToEverySession: boolean
): BillableLineItem | null {
	if (!Number.isInteger(quantity) || quantity <= 0) {
		return null;
	}

	const appliedToEverySession = scope.sessionCount > 1 && applyToEverySession;
	const billableQuantity = appliedToEverySession ? quantity * scope.sessionCount : quantity;
	const amount = ADDON_PRICES[addon] * billableQuantity;

	return {
		description: formatAddonBillableDescription(addon, billableQuantity, {
			appliedToEverySession,
			sessionCount: scope.sessionCount
		}),
		amount
	};
}

export function buildStudioHirePricedLine(
	duration: BookingDuration,
	quantity: number
): PricedLineItem {
	const unitAmount = DURATION_PRICES[duration];

	return {
		description: `Studio Hire (${duration})`,
		unitAmount,
		quantity,
		amount: unitAmount * quantity
	};
}

export function buildAddonPricedLine(addon: BookingAddon, quantity: number): PricedLineItem | null {
	if (!Number.isInteger(quantity) || quantity <= 0) {
		return null;
	}

	const unitAmount = ADDON_PRICES[addon];

	return {
		description: getCustomerAddonDisplayLabel(addon),
		unitAmount,
		quantity,
		amount: unitAmount * quantity
	};
}

export type SessionPriceInput = {
	duration: string;
	addons: readonly BookingAddon[];
	addonQuantity: (addon: BookingAddon) => number;
};

export type SessionPriceAmounts = {
	addonsAmount: number;
	baseAmount: number;
	subtotalAmount: number;
};

export function buildSessionPriceLines(input: {
	duration: BookingDuration;
	addons: readonly BookingAddon[];
	addonQuantity: (addon: BookingAddon) => number;
}): PricedLineItem[] {
	const lines: PricedLineItem[] = [buildStudioHirePricedLine(input.duration, 1)];

	for (const addon of input.addons) {
		const pricedLine = buildAddonPricedLine(addon, input.addonQuantity(addon));

		if (pricedLine !== null) {
			lines.push(pricedLine);
		}
	}

	return lines;
}

export function getSessionPriceAmounts(input: SessionPriceInput): SessionPriceAmounts {
	const baseAmount = isBookingDuration(input.duration)
		? buildStudioHirePricedLine(input.duration, 1).amount
		: 0;

	let addonsAmount = 0;

	for (const addon of input.addons) {
		const pricedLine = buildAddonPricedLine(addon, input.addonQuantity(addon));

		if (pricedLine !== null) {
			addonsAmount += pricedLine.amount;
		}
	}

	return { baseAmount, addonsAmount, subtotalAmount: baseAmount + addonsAmount };
}

export type PackagePriceInput = {
	addons: readonly BookingAddon[];
	addonQuantityPerSession: (addon: BookingAddon) => number;
	duration: BookingDuration;
	packageSize: PackageSize;
};

export function buildPackagePriceLines(input: PackagePriceInput): PricedLineItem[] {
	const lines: PricedLineItem[] = [buildStudioHirePricedLine(input.duration, input.packageSize)];

	for (const addon of input.addons) {
		const quantityPerSession = input.addonQuantityPerSession(addon);

		if (quantityPerSession <= 0) {
			continue;
		}

		const pricedLine = buildAddonPricedLine(addon, input.packageSize * quantityPerSession);

		if (pricedLine !== null) {
			lines.push(pricedLine);
		}
	}

	return lines;
}

export function getPackagePriceSubtotalBeforeDiscount(input: PackagePriceInput): number {
	return buildPackagePriceLines(input).reduce((total, line) => total + line.amount, 0);
}

export function getAvailableDurationUpgradeOptions(currentDuration: BookingDuration) {
	const currentIndex = getDurationIndex(currentDuration);

	return DURATION_OPTIONS.filter((_duration, index) => index > currentIndex);
}
