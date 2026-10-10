/**
 * Existing billing owners may write their recovery tables and original payment snapshots.
 * Nonowners cannot write those tables or visible originalPaidAmount fields, while unrelated
 * tables, fields, tests, and payloads hidden behind variables remain outside this syntax check.
 */
import { RuleTester } from "oxlint/plugins-dev";

import { noBillingRecoveryStateWriteOutsideOwnerRule } from "./no-billing-recovery-state-write-outside-owner.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run(
	"convex-layers/no-billing-recovery-state-write-outside-owner",
	noBillingRecoveryStateWriteOutsideOwnerRule,
	{
		valid: [
			{
				filename: "convex/stripe/lib/stripeInvoices.ts",
				code: `ctx.db.insert("stripeInvoices", invoice); ctx.db.patch("stripeInvoices", id, { paymentStatus: "paid" });`
			},
			{
				filename: "convex/packages/lib/packageAdjustments.ts",
				code: `ctx.db.insert("packageAdjustments", adjustment); ctx.db.patch("packageAdjustments", id, { invoiceEmailStatus: "sent" });`
			},
			{
				filename: "convex/packages/lib/packageAdjustmentInvoicePayment.ts",
				code: `ctx.db["patch"]("packageAdjustments", id, { paymentStatus: "paid" });`
			},
			{
				filename: "convex/booking/lib/bookingConfirmationSessionPatches.ts",
				code: `ctx.db.patch("bookings", id, { originalPaidAmount: amount });`
			},
			{
				filename: "convex/packages/lib/packageUpdates.ts",
				code: `ctx.db.patch("packages", id, { ["originalPaidAmount"]: amount });`
			},
			{
				filename: "convex/stripe/lib/editInvoiceDb.ts",
				code: `ctx.db.patch("bookings", id, { ...{ originalPaidAmount: amount } }); ctx.db.patch("packages", id, { originalPaidAmount: amount });`
			},
			{
				filename: "convex/booking/lib/bookingConfirmationSessionPatches.ts",
				code: `ctx.db.patch("bookings", id, bookingPatch);`
			},
			{
				filename: "convex/booking/lib/bookingConfirmationSave.ts",
				code: `ctx.db.patch("bookings", id, { paymentCompletedAt: at, status: "confirmed" });`
			},
			{
				filename: "convex/stripe/lib/editInvoiceDb.ts",
				code: `ctx.db.patch("customInvoices", id, { originalPaidAmount: amount });`
			},
			{
				filename: "convex/tests/stripeInvoices.test.ts",
				code: `ctx.db.insert("stripeInvoices", invoice); ctx.db.patch("packages", id, { originalPaidAmount: amount });`
			}
		],
		invalid: [
			{
				filename: "convex/stripe/lib/stripeInvoiceSend.ts",
				code: `ctx.db.insert("stripeInvoices", invoice);`,
				errors: [{ messageId: "stripeInvoicesWrite" }]
			},
			{
				filename: "convex/services/packages/packageAdjustmentInvoicePayment.ts",
				code: `ctx.db["replace"](\`packageAdjustments\`, id, {});`,
				errors: [{ messageId: "packageAdjustmentsWrite" }]
			},
			{
				filename: "convex/booking/lib/bookingConfirmationSave.ts",
				code: `ctx.db.patch("bookings", id, { originalPaidAmount: amount });`,
				errors: [{ messageId: "bookingOriginalPaidAmount" }]
			},
			{
				filename: "convex/stripe/lib/stripeInvoices.ts",
				code: `ctx.db.patch("packages", id, { ...{ ["originalPaidAmount"]: amount } });`,
				errors: [{ messageId: "packageOriginalPaidAmount" }]
			},
			{
				filename: "convex/packages/lib/packageUpdates.ts",
				code: `ctx.db.insert("bookings", { ...{ originalPaidAmount: amount } });`,
				errors: [{ messageId: "bookingOriginalPaidAmount" }]
			}
		]
	}
);
