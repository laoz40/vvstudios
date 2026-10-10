import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";
import {
	getDirectDbWrite,
	isConvexTestFile,
	normalizedConvexFilename
} from "../shared/direct-db-writes.ts";

const TABLE_WRITERS = new Map([
	["stripeInvoices", new Set(["convex/stripe/lib/stripeInvoices.ts"])],
	[
		"packageAdjustments",
		new Set([
			"convex/packages/lib/packageAdjustments.ts",
			"convex/packages/lib/packageAdjustmentInvoicePayment.ts"
		])
	]
]);

const ORIGINAL_PAID_AMOUNT_WRITERS = new Map([
	[
		"bookings",
		new Set([
			"convex/booking/lib/bookingConfirmationSessionPatches.ts",
			"convex/stripe/lib/editInvoiceDb.ts"
		])
	],
	[
		"packages",
		new Set([
			"convex/packages/lib/packageUpdates.ts",
			"convex/stripe/lib/editInvoiceDb.ts"
		])
	]
]);

/** Restricts direct writes to billing recovery state to the existing owning lib primitives. */
export const noBillingRecoveryStateWriteOutsideOwnerRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Restrict billing recovery state writes to their owning Convex lib primitives."
		},
		messages: {
			stripeInvoicesWrite:
				"Write stripeInvoices through recordBookingStripeInvoice, recordPackageStripeInvoice, recordPackageAdjustmentStripeInvoice, or patchStripeInvoicePaymentStatus in convex/stripe/lib/stripeInvoices.ts.",
			packageAdjustmentsWrite:
				"Write packageAdjustments through insertNoChargePackageAdjustment, insertPackageAdjustmentInvoice, patchPackageAdjustmentInvoiceNumber, patchPackageAdjustmentInvoiceEmailClaimed, patchPackageAdjustmentInvoiceEmailFailed, patchPackageAdjustmentInvoiceEmailSent, or patchPackageAdjustmentPaymentStatus in convex/packages/lib/packageAdjustments.ts, or claimPackageAdjustmentInvoicePayment in convex/packages/lib/packageAdjustmentInvoicePayment.ts.",
			bookingOriginalPaidAmount:
				"Write bookings.originalPaidAmount through patchBookingStripeConfirmationClaim in convex/booking/lib/bookingConfirmationSessionPatches.ts or patchOriginalPaidAmount in convex/stripe/lib/editInvoiceDb.ts.",
			packageOriginalPaidAmount:
				"Write packages.originalPaidAmount through patchPackageCheckoutClaimed in convex/packages/lib/packageUpdates.ts or patchOriginalPaidAmount in convex/stripe/lib/editInvoiceDb.ts."
		}
	},
	create(context) {
		const filename = normalizedConvexFilename(context.filename);
		if (isConvexTestFile(context.filename)) return {};

		return {
			CallExpression(node: ESTree.CallExpression) {
				const write = getDirectDbWrite(node);
				if (!write || write.table === undefined) return;

				const tableWriters = TABLE_WRITERS.get(write.table);
				if (tableWriters) {
					if (!tableWriters.has(filename)) {
						context.report({
							node,
							messageId:
								write.table === "stripeInvoices"
									? "stripeInvoicesWrite"
									: "packageAdjustmentsWrite"
						});
					}
					return;
				}

				if (write.table !== "bookings" && write.table !== "packages") return;
				if (!write.fields.has("originalPaidAmount")) return;
				if (ORIGINAL_PAID_AMOUNT_WRITERS.get(write.table)?.has(filename)) return;

				context.report({
					node,
					messageId:
						write.table === "bookings"
							? "bookingOriginalPaidAmount"
							: "packageOriginalPaidAmount"
				});
			}
		};
	}
});
