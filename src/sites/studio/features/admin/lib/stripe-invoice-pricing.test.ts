/**
 * Stripe invoice line item pricing from structured admin selections.
 *
 * 1. Duration upgrade
 *    Charges the price difference for a longer session duration. Downgrades are rejected.
 *
 * 2. Session add-ons
 *    Uses catalog prices with optional quantity for editing add-ons.
 *
 * 3. Package add-ons
 *    Optional apply-to-every-session multiplies quantity by package size.
 *
 * 4. Package duration upgrade
 *    Optional apply-to-all-sessions multiplies the per-session duration difference.
 */
import { describe, expect, test } from "vitest";
import {
	buildStripeInvoiceLineItemsFromDrafts,
	calculateAddonLineItem,
	calculateDurationUpgradeLineItem,
	getAvailableDurationUpgradeOptions,
	getApplyToAllSessionsLabel,
	getStripeInvoiceLineItemOptions,
	getStripeInvoiceLineItemSelectionValue,
	parseStripeInvoiceLineItemSelection,
	sumStripeInvoiceLineItemDrafts,
	type StripeInvoiceContext,
	type StripeInvoiceLineItemDraft
} from "#studio/features/admin/lib/stripe-invoice-pricing";

const sessionContext: StripeInvoiceContext = { currentDuration: "2h", sessionCount: 1 };

const packageContext: StripeInvoiceContext = { currentDuration: "2h", sessionCount: 8 };

function createDraft(
	overrides: Partial<StripeInvoiceLineItemDraft> = {}
): StripeInvoiceLineItemDraft {
	return {
		id: "line-1",
		kind: "",
		newDuration: "",
		addon: "",
		quantity: "",
		applyToEverySession: false,
		...overrides
	};
}

describe("getAvailableDurationUpgradeOptions", () => {
	test("returns only longer durations than the current booking", () => {
		expect(getAvailableDurationUpgradeOptions("1h")).toEqual(["2h", "3h"]);
		expect(getAvailableDurationUpgradeOptions("2h")).toEqual(["3h"]);
		expect(getAvailableDurationUpgradeOptions("3h")).toEqual([]);
	});
});

describe("calculateDurationUpgradeLineItem", () => {
	test("charges the session price difference when upgrading duration", () => {
		expect(calculateDurationUpgradeLineItem(sessionContext, "3h", false)).toEqual({
			description: "Studio hire upgrade: 2h to 3h",
			amount: 100
		});
	});

	test("rejects duration downgrades because refunds are not supported", () => {
		expect(calculateDurationUpgradeLineItem(sessionContext, "1h", false)).toBeNull();
	});

	test("rejects selecting the same duration", () => {
		expect(calculateDurationUpgradeLineItem(sessionContext, "2h", false)).toBeNull();
	});

	test("charges one session when package duration upgrade is not applied to every session", () => {
		expect(calculateDurationUpgradeLineItem(packageContext, "3h", false)).toEqual({
			description: "Studio hire upgrade: 2h to 3h",
			amount: 100
		});
	});

	test("applies the duration difference across every package session when checked", () => {
		expect(calculateDurationUpgradeLineItem(packageContext, "3h", true)).toEqual({
			description: "Studio hire upgrade (8 sessions): 2h to 3h",
			amount: 800
		});
	});
});

describe("calculateAddonLineItem", () => {
	test("charges the catalog price for a production add-on", () => {
		expect(calculateAddonLineItem(sessionContext, "Teleprompter", 1, false)).toEqual({
			description: "Teleprompter",
			amount: 29
		});
	});

	test("charges quantity times the catalog price for editing add-ons", () => {
		expect(calculateAddonLineItem(sessionContext, "Essential Edit", 2, false)).toEqual({
			description: "Rough Cut x2",
			amount: 200
		});
	});

	test("charges only the selected quantity when package add-on is not applied to every session", () => {
		expect(calculateAddonLineItem(packageContext, "Essential Edit", 2, false)).toEqual({
			description: "Rough Cut x2",
			amount: 200
		});
	});

	test("multiplies quantity by package size when apply to every session is checked", () => {
		expect(calculateAddonLineItem(packageContext, "Essential Edit", 2, true)).toEqual({
			description: "Rough Cut x16 (8 sessions)",
			amount: 1600
		});
	});
});

describe("buildStripeInvoiceLineItemsFromDrafts", () => {
	test("builds multiple priced line items from structured selections", () => {
		const lineItems = buildStripeInvoiceLineItemsFromDrafts(
			[
				createDraft({ kind: "duration_upgrade", newDuration: "3h" }),
				createDraft({ id: "line-2", kind: "addon", addon: "Teleprompter", quantity: "1" })
			],
			sessionContext
		);

		expect(lineItems).toEqual([
			{ description: "Studio hire upgrade: 2h to 3h", amount: 100 },
			{ description: "Teleprompter", amount: 29 }
		]);
	});

	test("returns null when a line item selection is incomplete", () => {
		expect(
			buildStripeInvoiceLineItemsFromDrafts(
				[createDraft({ kind: "addon", addon: "Teleprompter", quantity: "" })],
				sessionContext
			)
		).toBeNull();
	});

	test("returns null when there are no line items", () => {
		expect(buildStripeInvoiceLineItemsFromDrafts([], sessionContext)).toBeNull();
	});
});

describe("getApplyToAllSessionsLabel", () => {
	test("uses the session count in the checkbox label", () => {
		expect(getApplyToAllSessionsLabel(4)).toBe("Apply to all 4 sessions");
	});
});

describe("getStripeInvoiceLineItemOptions", () => {
	test("lists duration upgrades before add-ons in one picker", () => {
		expect(getStripeInvoiceLineItemOptions(sessionContext).map((option) => option.value)).toEqual([
			"duration_upgrade:3h",
			"addon:Remote Podcast",
			"addon:4K UHD Recording",
			"addon:Teleprompter",
			"addon:Essential Edit",
			"addon:Complete Edit",
			"addon:Clip Volume Pack",
			"addon:Handcrafted Clips"
		]);
	});
});

describe("getStripeInvoiceLineItemSelectionValue", () => {
	test("encodes duration upgrades and add-ons for the combined picker", () => {
		expect(
			getStripeInvoiceLineItemSelectionValue({
				kind: "duration_upgrade",
				newDuration: "3h",
				addon: ""
			})
		).toBe("duration_upgrade:3h");

		expect(
			getStripeInvoiceLineItemSelectionValue({
				kind: "addon",
				newDuration: "",
				addon: "Teleprompter"
			})
		).toBe("addon:Teleprompter");
	});
});

describe("parseStripeInvoiceLineItemSelection", () => {
	test("maps a duration upgrade selection onto the draft fields", () => {
		expect(parseStripeInvoiceLineItemSelection("duration_upgrade:3h")).toEqual({
			kind: "duration_upgrade",
			newDuration: "3h",
			addon: "",
			quantity: "1",
			applyToEverySession: false
		});
	});

	test("maps an add-on selection and leaves quantity empty when it is required", () => {
		expect(parseStripeInvoiceLineItemSelection("addon:Essential Edit")).toEqual({
			kind: "addon",
			addon: "Essential Edit",
			newDuration: "",
			quantity: "",
			applyToEverySession: false
		});
	});

	test("defaults quantity to one for add-ons that do not track quantity", () => {
		expect(parseStripeInvoiceLineItemSelection("addon:Teleprompter")).toEqual({
			kind: "addon",
			addon: "Teleprompter",
			newDuration: "",
			quantity: "1",
			applyToEverySession: false
		});
	});
});

describe("sumStripeInvoiceLineItemDrafts", () => {
	test("totals the priced line items", () => {
		expect(
			sumStripeInvoiceLineItemDrafts(
				[
					createDraft({ kind: "duration_upgrade", newDuration: "3h" }),
					createDraft({ id: "line-2", kind: "addon", addon: "Teleprompter", quantity: "1" })
				],
				sessionContext
			)
		).toBe(129);
	});

	test("returns null when pricing cannot be calculated", () => {
		expect(
			sumStripeInvoiceLineItemDrafts(
				[createDraft({ kind: "duration_upgrade", newDuration: "1h" })],
				sessionContext
			)
		).toBeNull();
	});
});
