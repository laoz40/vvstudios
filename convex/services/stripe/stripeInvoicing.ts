import type { ActionCtx } from "#convex/_generated/server";
import type { Id } from "#convex/_generated/dataModel";
import type { StripeInvoiceLineItem } from "#convex/lib/stripe/stripeInvoice";
import {
	createAndRecordBookingStripeInvoice as createAndRecordBookingStripeInvoiceImpl,
	createAndRecordPackageStripeInvoice as createAndRecordPackageStripeInvoiceImpl,
	loadBookingStripeCustomerId as loadBookingStripeCustomerIdImpl,
	loadPackageStripeCustomerId as loadPackageStripeCustomerIdImpl,
	requireSendReceiptEmailsAndValidateLineItems as requireSendReceiptEmailsAndValidateLineItemsImpl
} from "#convex/services/stripe/stripeInvoiceSend";

type StripeInvoiceSenderIdentity = { email?: string };

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
) {
	return requireSendReceiptEmailsAndValidateLineItemsImpl(ctx, lineItems);
}

export function loadBookingStripeCustomerId(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return loadBookingStripeCustomerIdImpl(ctx, bookingId);
}

export function loadPackageStripeCustomerId(ctx: ActionCtx, packageId: Id<"packages">) {
	return loadPackageStripeCustomerIdImpl(ctx, packageId);
}

export function createAndRecordBookingStripeInvoice(
	ctx: ActionCtx,
	args: Parameters<typeof createAndRecordBookingStripeInvoiceImpl>[1],
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
) {
	return createAndRecordBookingStripeInvoiceImpl(ctx, args, identity, stripeCustomerId);
}

export function createAndRecordPackageStripeInvoice(
	ctx: ActionCtx,
	args: Parameters<typeof createAndRecordPackageStripeInvoiceImpl>[1],
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
) {
	return createAndRecordPackageStripeInvoiceImpl(ctx, args, identity, stripeCustomerId);
}
