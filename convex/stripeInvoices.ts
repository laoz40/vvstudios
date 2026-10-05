import { okAsync } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import {
	listStripeInvoicesForBooking as listBookingStripeInvoices,
	listStripeInvoicesForPackage as listPackageStripeInvoices,
	markStripeInvoicePaid as claimStripeInvoicePaid,
	recordBookingStripeInvoice as insertBookingStripeInvoice,
	recordPackageAdjustmentStripeInvoice as insertPackageAdjustmentStripeInvoice,
	recordPackageStripeInvoice as insertPackageStripeInvoice
} from "#convex/lib/stripe/stripeInvoices";
import {
	archiveBookingWhenStripeInvoicePaid,
	unarchiveAfterNewBookingInvoice,
	unarchiveAfterNewPackageInvoice
} from "#convex/services/stripe/stripeInvoices";

const stripeInvoiceLineItemValidator = v.object({ description: v.string(), amount: v.number() });

export const recordBookingStripeInvoice = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string(),
		createdBy: v.optional(v.string())
	},
	handler: async (ctx, args) =>
		insertBookingStripeInvoice(ctx, args)
			.andThen((insertResult) => unarchiveAfterNewBookingInvoice(ctx, args.bookingId, insertResult))
			.match(tupleOk, tupleErr)
});

export const recordPackageStripeInvoice = internalMutation({
	args: {
		packageId: v.id("packages"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		requestId: v.string(),
		createdBy: v.optional(v.string())
	},
	handler: async (ctx, args) =>
		insertPackageStripeInvoice(ctx, args)
			.andThen((insertResult) => unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult))
			.match(tupleOk, tupleErr)
});

export const recordPackageAdjustmentStripeInvoice = internalMutation({
	args: {
		packageId: v.id("packages"),
		packageAdjustmentId: v.id("packageAdjustments"),
		stripeInvoiceId: v.string(),
		lineItems: v.array(stripeInvoiceLineItemValidator),
		totalAmount: v.number()
	},
	handler: async (ctx, args) =>
		insertPackageAdjustmentStripeInvoice(ctx, args)
			.andThen((insertResult) => unarchiveAfterNewPackageInvoice(ctx, args.packageId, insertResult))
			.match(tupleOk, tupleErr)
});

export const markStripeInvoicePaid = internalMutation({
	args: { stripeInvoiceId: v.string(), paidAt: v.number() },
	handler: async (ctx, args) =>
		claimStripeInvoicePaid(ctx, args)
			.andThen((claim) => {
				if (claim.outcome === "not_found") {
					return okAsync(claim);
				}

				return archiveBookingWhenStripeInvoicePaid(ctx, args.stripeInvoiceId, args.paidAt).map(
					() => claim
				);
			})
			.match(tupleOk, tupleErr)
});

export const listStripeInvoicesForBooking = query({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		requirePermission(ctx, "view:sensitive-booking-data")
			.andThen(() => listBookingStripeInvoices(ctx, args.bookingId))
			.match(tupleOk, tupleErr)
});

export const listStripeInvoicesForPackage = query({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) =>
		requirePermission(ctx, "view:sensitive-booking-data")
			.andThen(() => listPackageStripeInvoices(ctx, args.packageId))
			.match(tupleOk, tupleErr)
});
