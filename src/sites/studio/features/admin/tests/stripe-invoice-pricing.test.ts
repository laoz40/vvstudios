/**
 * Admin Stripe invoice draft UI and line item assembly.
 *
 * 1. Draft assembly
 *    Builds priced invoice lines from structured admin selections.
 *
 * 2. Picker encoding
 *    Combined duration and add-on options for the line item selector.
 *
 * 3. Draft totals
 *    Sums priced lines or returns null when pricing is incomplete.
 */
import { describe, expect, test } from "vitest";
import {
	buildStripeInvoiceLineItemsFromDrafts,
	getApplyToAllSessionsLabel,
	getStripeInvoiceLineItemOptions,
	getStripeInvoiceLineItemSelectionValue,
	parseStripeInvoiceLineItemSelection,
	sumStripeInvoiceLineItemDrafts,
	type StripeInvoiceContext,
	type StripeInvoiceLineItemDraft
} from "#studio/features/admin/lib/stripe-invoice-pricing";

const sessionContext: StripeInvoiceContext = { currentDuration: "2h", sessionCount: 1 };

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
