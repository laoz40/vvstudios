"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	requirePermissionActions,
	type PermissionActionError
} from "#convex/services/requirePermissionActions";
import type { StripeInvoiceBillingUrls } from "#convex/lib/stripe/stripeInvoiceBillingUrls";
import { getPackageForAction } from "#convex/services/packages/packageLookup";
import { fromConvexTuple } from "#convex/lib/result";
import { getSessionFromQuery } from "#convex/services/sessions/sessionLookup";
import {
	createAndSendStripeInvoice,
	type StripeInvoiceLineItem,
	validateStripeInvoiceLineItems
} from "#convex/lib/stripe/stripeInvoice";
import { getStripeInvoiceBillingUrls as fetchStripeInvoiceBillingUrls } from "#convex/lib/stripe/stripeInvoiceBillingUrls";
import { getStripeClient } from "#convex/lib/stripe/stripeClient";

type StripeInvoiceSenderIdentity = { email?: string };

function requireStripeCustomerId(stripeCustomerId: string | undefined) {
	if (!stripeCustomerId) {
		return err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
	}

	return ok(stripeCustomerId);
}

function attachIdentityAndLineItems(identity: StripeInvoiceSenderIdentity) {
	return (validatedLineItems: StripeInvoiceLineItem[]) => ({
		identity,
		lineItems: validatedLineItems
	});
}

function attachValidatedLineItems(lineItems: StripeInvoiceLineItem[]) {
	return (identity: StripeInvoiceSenderIdentity) =>
		validateStripeInvoiceLineItems(lineItems).map(attachIdentityAndLineItems(identity));
}

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
): ResultAsync<
	{ identity: { email?: string }; lineItems: StripeInvoiceLineItem[] },
	{ reason: string }
> {
	return requirePermissionActions(ctx, "send:receipt-emails").andThen(
		attachValidatedLineItems(lineItems)
	);
}

function stripeCustomerIdFromSession(session: { stripeCustomerId?: string }) {
	return requireStripeCustomerId(session.stripeCustomerId);
}

function stripeCustomerIdFromPackage(packageRecord: { stripeCustomerId?: string }) {
	return requireStripeCustomerId(packageRecord.stripeCustomerId);
}

export function loadBookingStripeCustomerId(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<string, { reason: string }> {
	return getSessionFromQuery(ctx, bookingId).andThen(stripeCustomerIdFromSession);
}

export function loadPackageStripeCustomerId(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<string, { reason: string }> {
	return getPackageForAction(ctx, packageId).andThen(stripeCustomerIdFromPackage);
}

function fetchStripeInvoiceBillingUrlsForStaff(stripeInvoiceId: string) {
	return () => fetchStripeInvoiceBillingUrls(getStripeClient(), stripeInvoiceId);
}

export function loadStripeInvoiceBillingUrlsForStaff(
	ctx: ActionCtx,
	stripeInvoiceId: string
): ResultAsync<
	StripeInvoiceBillingUrls,
	PermissionActionError | { reason: "STRIPE_INVOICE_LOOKUP_FAILED" }
> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data").andThen(
		fetchStripeInvoiceBillingUrlsForStaff(stripeInvoiceId)
	);
}

function toStripeInvoiceIdFromMutation(stripeInvoiceId: string) {
	return () => ({ stripeInvoiceId });
}

function recordBookingStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity
) {
	return ({ stripeInvoiceId }: { stripeInvoiceId: string }) =>
		fromConvexTuple(
			ctx.runMutation(internal.stripeInvoices.recordBookingStripeInvoice, {
				bookingId: args.bookingId,
				stripeInvoiceId,
				lineItems: args.lineItems,
				requestId: args.requestId,
				createdBy: identity.email
			})
		).map(toStripeInvoiceIdFromMutation(stripeInvoiceId));
}

function recordPackageStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity
) {
	return ({ stripeInvoiceId }: { stripeInvoiceId: string }) =>
		fromConvexTuple(
			ctx.runMutation(internal.stripeInvoices.recordPackageStripeInvoice, {
				packageId: args.packageId,
				stripeInvoiceId,
				lineItems: args.lineItems,
				requestId: args.requestId,
				createdBy: identity.email
			})
		).map(toStripeInvoiceIdFromMutation(stripeInvoiceId));
}

export function createAndRecordBookingStripeInvoice(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	const stripe = getStripeClient();

	return createAndSendStripeInvoice(stripe, {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "booking", bookingId: args.bookingId, requestId: args.requestId }
	}).andThen(recordBookingStripeInvoiceAfterSend(ctx, args, identity));
}

export function createAndRecordPackageStripeInvoice(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	const stripe = getStripeClient();

	return createAndSendStripeInvoice(stripe, {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "package", packageId: args.packageId, requestId: args.requestId }
	}).andThen(recordPackageStripeInvoiceAfterSend(ctx, args, identity));
}
