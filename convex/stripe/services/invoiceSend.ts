"use node";

import type { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	requirePermissionActions,
	type PermissionActionError
} from "#convex/shared/services/requirePermissionActions";
import type { StripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import { getPackageForAction } from "#convex/packages/services/lookup";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import {
	validateStripeInvoiceLineItems,
	createAndSendBookingStripeInvoice,
	createAndSendPackageStripeInvoice,
	createAndSendOptionalEditInvoice,
	recordBookingStripeInvoiceFromAction,
	recordPackageStripeInvoiceFromAction,
	recordOptionalEditInvoiceFromAction,
	requireStripeInvoiceCustomerId,
	type StripeInvoiceLineItem,
	type StripeInvoiceSenderIdentity
} from "#convex/stripe/lib/invoice";
import { getStripeInvoiceBillingUrls as fetchStripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import { getStripeClient } from "#convex/stripe/lib/client";

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
): ResultAsync<
	{ identity: { email?: string }; lineItems: StripeInvoiceLineItem[] },
	{ reason: string }
> {
	return requirePermissionActions(ctx, "send:receipt-emails").andThen(
		(identity: StripeInvoiceSenderIdentity) =>
			validateStripeInvoiceLineItems(lineItems).map((validatedLineItems) => ({
				identity,
				lineItems: validatedLineItems
			}))
	);
}

export function loadBookingStripeCustomerId(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<string, { reason: string }> {
	return getSessionFromQuery(ctx, bookingId).andThen((session) =>
		requireStripeInvoiceCustomerId(session.stripeCustomerId)
	);
}

export function loadPackageStripeCustomerId(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<string, { reason: string }> {
	return getPackageForAction(ctx, packageId).andThen((packageRecord) =>
		requireStripeInvoiceCustomerId(packageRecord.stripeCustomerId)
	);
}

export function loadStripeInvoiceBillingUrlsForStaff(
	ctx: ActionCtx,
	stripeInvoiceId: string
): ResultAsync<
	StripeInvoiceBillingUrls,
	PermissionActionError | { reason: "STRIPE_INVOICE_LOOKUP_FAILED" }
> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data").andThen(() =>
		fetchStripeInvoiceBillingUrls(getStripeClient(), stripeInvoiceId)
	);
}

function recordBookingStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return fromConvexTuple(
		recordBookingStripeInvoiceFromAction(ctx, args, identity, stripeInvoiceId)
	).map(() => ({ stripeInvoiceId }));
}

function recordPackageStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return fromConvexTuple(
		recordPackageStripeInvoiceFromAction(ctx, args, identity, stripeInvoiceId)
	).map(() => ({ stripeInvoiceId }));
}

export function createAndRecordBookingStripeInvoice(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return createAndSendBookingStripeInvoice(getStripeClient(), args, stripeCustomerId).andThen(
		(stripeInvoice) => recordBookingStripeInvoiceAfterSend(ctx, args, identity, stripeInvoice)
	);
}

export function createAndRecordPackageStripeInvoice(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return createAndSendPackageStripeInvoice(getStripeClient(), args, stripeCustomerId).andThen(
		(stripeInvoice) => recordPackageStripeInvoiceAfterSend(ctx, args, identity, stripeInvoice)
	);
}

export function createAndRecordOptionalEditInvoice(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget | null; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string } | null, { reason: string }> {
	return createAndSendOptionalEditInvoice(getStripeClient(), { ...args, stripeCustomerId }).andThen(
		(stripeInvoice) =>
			recordOptionalEditInvoiceFromAction(ctx, {
				...args,
				createdBy: identity.email,
				stripeInvoiceId: stripeInvoice?.stripeInvoiceId ?? null
			}).map(() => stripeInvoice)
	);
}
