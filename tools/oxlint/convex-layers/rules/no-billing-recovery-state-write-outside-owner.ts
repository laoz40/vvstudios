import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";
import {
	getDirectDbWrite,
	isConvexTestFile,
	normalizedConvexFilename
} from "../shared/direct-db-writes.ts";

const TABLE_WRITERS = new Map([
	["stripeInvoices", new Set(["convex/lib/stripe/stripeInvoices.ts"])],
	[
		"packageAdjustments",
		new Set([
			"convex/lib/packages/packageAdjustments.ts",
			"convex/lib/packages/packageAdjustmentInvoicePayment.ts"
		])
	]
]);

const ORIGINAL_PAID_AMOUNT_WRITERS = new Map([
	[
		"bookings",
		new Set([
			"convex/lib/booking/bookingConfirmationSessionPatches.ts",
			"convex/lib/stripe/editInvoiceDb.ts"
		])
	],
	[
		"packages",
		new Set([
			"convex/lib/packages/packageUpdates.ts",
			"convex/lib/stripe/editInvoiceDb.ts"
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
				"Write stripeInvoices through recordBookingStripeInvoice, recordPackageStripeInvoice, recordPackageAdjustmentStripeInvoice, or patchStripeInvoicePaymentStatus in convex/lib/stripe/stripeInvoices.ts.",
			packageAdjustmentsWrite:
				"Write packageAdjustments through insertNoChargePackageAdjustment, insertPackageAdjustmentInvoice, patchPackageAdjustmentInvoiceNumber, patchPackageAdjustmentInvoiceEmailClaimed, patchPackageAdjustmentInvoiceEmailFailed, patchPackageAdjustmentInvoiceEmailSent, or patchPackageAdjustmentPaymentStatus in convex/lib/packages/packageAdjustments.ts, or claimPackageAdjustmentInvoicePayment in convex/lib/packages/packageAdjustmentInvoicePayment.ts.",
			bookingOriginalPaidAmount:
				"Write bookings.originalPaidAmount through patchBookingStripeConfirmationClaim in convex/lib/booking/bookingConfirmationSessionPatches.ts or patchOriginalPaidAmount in convex/lib/stripe/editInvoiceDb.ts.",
			packageOriginalPaidAmount:
				"Write packages.originalPaidAmount through patchPackageCheckoutClaimed in convex/lib/packages/packageUpdates.ts or patchOriginalPaidAmount in convex/lib/stripe/editInvoiceDb.ts."
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
