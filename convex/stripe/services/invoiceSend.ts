"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	requirePermissionActions,
	type PermissionActionError
} from "#convex/shared/services/requirePermissionActions";
import type { StripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import { getPackageForAction } from "#convex/packages/services/lookup";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import {
	createAndSendStripeInvoice,
	type StripeInvoiceLineItem,
	validateStripeInvoiceLineItems
} from "#convex/stripe/lib/invoice";
import { getStripeInvoiceBillingUrls as fetchStripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import { getStripeClient } from "#convex/stripe/lib/client";

type StripeInvoiceSenderIdentity = { email?: string };

function requireStripeCustomerId(stripeCustomerId: string | undefined) {
	if (!stripeCustomerId) {
		return err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
	}

	return ok(stripeCustomerId);
}

function attachIdentityAndLineItems(
	identity: StripeInvoiceSenderIdentity,
	validatedLineItems: StripeInvoiceLineItem[]
) {
	return { identity, lineItems: validatedLineItems };
}

function attachValidatedLineItems(
	lineItems: StripeInvoiceLineItem[],
	identity: StripeInvoiceSenderIdentity
) {
	return validateStripeInvoiceLineItems(lineItems).map(
		(validatedLineItems: StripeInvoiceLineItem[]) =>
			attachIdentityAndLineItems(identity, validatedLineItems)
	);
}

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
): ResultAsync<
	{ identity: { email?: string }; lineItems: StripeInvoiceLineItem[] },
	{ reason: string }
> {
	return requirePermissionActions(ctx, "send:receipt-emails").andThen(
		(identity: StripeInvoiceSenderIdentity) => attachValidatedLineItems(lineItems, identity)
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
	return fetchStripeInvoiceBillingUrls(getStripeClient(), stripeInvoiceId);
}

export function loadStripeInvoiceBillingUrlsForStaff(
	ctx: ActionCtx,
	stripeInvoiceId: string
): ResultAsync<
	StripeInvoiceBillingUrls,
	PermissionActionError | { reason: "STRIPE_INVOICE_LOOKUP_FAILED" }
> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data").andThen(() =>
		fetchStripeInvoiceBillingUrlsForStaff(stripeInvoiceId)
	);
}

function toStripeInvoiceIdFromMutation(stripeInvoiceId: string) {
	return { stripeInvoiceId };
}

function recordBookingStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,

	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.stripe.invoiceRecords.recordBookingStripeInvoice, {
			bookingId: args.bookingId,
			stripeInvoiceId,
			lineItems: args.lineItems,
			requestId: args.requestId,
			createdBy: identity.email
		})
	).map(() => toStripeInvoiceIdFromMutation(stripeInvoiceId));
}

function recordPackageStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,

	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.stripe.invoiceRecords.recordPackageStripeInvoice, {
			packageId: args.packageId,
			stripeInvoiceId,
			lineItems: args.lineItems,
			requestId: args.requestId,
			createdBy: identity.email
		})
	).map(() => toStripeInvoiceIdFromMutation(stripeInvoiceId));
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
	}).andThen((_value) => recordBookingStripeInvoiceAfterSend(ctx, args, identity, _value));
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
	}).andThen((_value) => recordPackageStripeInvoiceAfterSend(ctx, args, identity, _value));
}
