import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import {
	ADDON_OPTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	DURATION_OPTIONS,
	getCustomerAddonDisplayLabel,
	isDurationOption,
	type BookingAddon
} from "#/domain/booking/catalog";
import { isQuantityTrackedAddon } from "#/domain/booking/addon-quantities";
import {
	getAvailableDurationUpgradeOptions,
	buildAddonBillableLine,
	buildDurationUpgradeBillableLine,
	type BillableSessionScope
} from "#/domain/booking/billable-line-items";
import { ADDON_PRICES } from "#/domain/booking/price-constants";
import type { ParsedStripeInvoiceLineItem } from "#studio/features/admin/lib/stripe-invoice-line-items";

const DURATION_UPGRADE_SELECTION_PREFIX = "duration_upgrade:";

const ADDON_SELECTION_PREFIX = "addon:";

export type StripeInvoiceLineItemOption = { value: string; label: string };

type BookingDuration = (typeof DURATION_OPTIONS)[number];

export type StripeInvoiceContext = BillableSessionScope & { currentDuration: BookingDuration };

export type StripeInvoiceLineItemDraft = {
	id: string;
	kind: "duration_upgrade" | "addon" | "";
	newDuration: BookingDuration | "";
	addon: BookingAddon | "";
	quantity: (typeof DELIVERABLE_COUNT_OPTIONS)[number] | "";
	applyToEverySession: boolean;
};

function calculateDurationUpgradeLineItem(
	context: StripeInvoiceContext,
	newDuration: BookingDuration,
	applyToEverySession: boolean
): ParsedStripeInvoiceLineItem | null {
	return buildDurationUpgradeBillableLine(
		context,
		context.currentDuration,
		newDuration,
		applyToEverySession
	);
}

export function getApplyToAllSessionsLabel(sessionCount: number) {
	return `Apply to all ${sessionCount} sessions`;
}

function calculateAddonLineItem(
	context: StripeInvoiceContext,
	addon: BookingAddon,
	quantity: number,
	applyToEverySession: boolean
): ParsedStripeInvoiceLineItem | null {
	return buildAddonBillableLine(context, addon, quantity, applyToEverySession);
}

function isDeliverableCount(value: string): value is (typeof DELIVERABLE_COUNT_OPTIONS)[number] {
	return DELIVERABLE_COUNT_OPTIONS.some((option) => option === value);
}

function buildLineItemFromDraft(
	draft: StripeInvoiceLineItemDraft,
	context: StripeInvoiceContext
): ParsedStripeInvoiceLineItem | null {
	if (draft.kind === "duration_upgrade") {
		if (draft.newDuration === "") {
			return null;
		}

		return calculateDurationUpgradeLineItem(context, draft.newDuration, draft.applyToEverySession);
	}

	if (draft.kind === "addon") {
		if (draft.addon === "" || draft.quantity === "" || !isDeliverableCount(draft.quantity)) {
			return null;
		}

		const quantity = Number(draft.quantity);

		return calculateAddonLineItem(context, draft.addon, quantity, draft.applyToEverySession);
	}

	return null;
}

export function buildStripeInvoiceLineItemsFromDrafts(
	drafts: StripeInvoiceLineItemDraft[],
	context: StripeInvoiceContext
): ParsedStripeInvoiceLineItem[] | null {
	if (drafts.length === 0) {
		return null;
	}

	const lineItems: ParsedStripeInvoiceLineItem[] = [];

	for (const draft of drafts) {
		if (draft.kind === "") {
			return null;
		}

		const lineItem = buildLineItemFromDraft(draft, context);

		if (lineItem === null) {
			return null;
		}

		lineItems.push(lineItem);
	}

	return lineItems;
}

export function sumStripeInvoiceLineItemDrafts(
	drafts: StripeInvoiceLineItemDraft[],
	context: StripeInvoiceContext
) {
	const lineItems = buildStripeInvoiceLineItemsFromDrafts(drafts, context);

	if (lineItems === null) {
		return null;
	}

	return lineItems.reduce((total, lineItem) => total + lineItem.amount, 0);
}

function getStripeInvoiceAddonOptions() {
	return ADDON_OPTIONS;
}

function addonRequiresQuantity(addon: BookingAddon) {
	return isQuantityTrackedAddon(addon);
}

function isStripeInvoiceAddon(value: string): value is BookingAddon {
	return ADDON_OPTIONS.some((addon) => addon === value);
}

export function getStripeInvoiceLineItemSelectionValue(
	draft: Pick<StripeInvoiceLineItemDraft, "kind" | "newDuration" | "addon">
) {
	if (draft.kind === "duration_upgrade" && draft.newDuration !== "") {
		return `${DURATION_UPGRADE_SELECTION_PREFIX}${draft.newDuration}`;
	}

	if (draft.kind === "addon" && draft.addon !== "") {
		return `${ADDON_SELECTION_PREFIX}${draft.addon}`;
	}

	return "";
}

export function parseStripeInvoiceLineItemSelection(
	value: string
): Partial<StripeInvoiceLineItemDraft> | null {
	if (value.startsWith(DURATION_UPGRADE_SELECTION_PREFIX)) {
		const newDuration = value.slice(DURATION_UPGRADE_SELECTION_PREFIX.length);

		if (!isDurationOption(newDuration)) {
			return null;
		}

		return {
			kind: "duration_upgrade",
			newDuration,
			addon: "",
			quantity: "1",
			applyToEverySession: false
		};
	}

	if (value.startsWith(ADDON_SELECTION_PREFIX)) {
		const addon = value.slice(ADDON_SELECTION_PREFIX.length);

		if (!isStripeInvoiceAddon(addon)) {
			return null;
		}

		return {
			kind: "addon",
			addon,
			newDuration: "",
			quantity: addonRequiresQuantity(addon) ? "" : "1",
			applyToEverySession: false
		};
	}

	return null;
}

export function getStripeInvoiceLineItemOptions(
	context: StripeInvoiceContext
): StripeInvoiceLineItemOption[] {
	const options: StripeInvoiceLineItemOption[] = [];

	for (const newDuration of getAvailableDurationUpgradeOptions(context.currentDuration)) {
		const lineItem = calculateDurationUpgradeLineItem(context, newDuration, false);

		if (lineItem === null) {
			continue;
		}

		options.push({
			value: `${DURATION_UPGRADE_SELECTION_PREFIX}${newDuration}`,
			label: `Duration upgrade: ${context.currentDuration} to ${newDuration} (${formatAudAmount(lineItem.amount)})`
		});
	}

	for (const addon of getStripeInvoiceAddonOptions()) {
		options.push({
			value: `${ADDON_SELECTION_PREFIX}${addon}`,
			label: `${getCustomerAddonDisplayLabel(addon)} (${formatAudAmount(ADDON_PRICES[addon])})`
		});
	}

	return options;
}
