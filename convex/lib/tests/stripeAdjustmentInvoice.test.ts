/**
 * These tests cover Stripe adjustment invoice due-date configuration.
 *
 * 1. Due date alignment
 *    Stripe invoice due days must match the package adjustment payment window.
 */
import { describe, expect, test } from "vitest";
import { PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS } from "#convex/lib/packageAdjustments";
import { PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE } from "#convex/lib/stripeAdjustmentInvoice";

describe("stripe adjustment invoice settings", () => {
	test("uses a seven-day Stripe invoice due date", () => {
		expect(PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE).toBe(7);
		expect(PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE * 24 * 60 * 60 * 1000).toBe(
			PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS
		);
	});
});
