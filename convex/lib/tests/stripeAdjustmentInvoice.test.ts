/**
 * Stripe adjustment invoice terms match the package payment window.
 *
 * 1. Invoice terms
 *    Due dates match the seven-day adjustment payment window.
 */
import { describe, expect, test } from "vitest";
import { PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS } from "#convex/lib/packages/packageAdjustments";
import { PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE } from "#convex/lib/stripe/stripeAdjustmentInvoice";

describe("stripe adjustment invoice settings", () => {
	test("uses a seven-day Stripe invoice due date", () => {
		expect(PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE).toBe(7);
		expect(PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE * 24 * 60 * 60 * 1000).toBe(
			PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS
		);
	});
});
