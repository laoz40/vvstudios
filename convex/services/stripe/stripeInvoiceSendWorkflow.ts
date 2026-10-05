"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { getPackageForAction } from "#convex/lib/packages/packageLookup";
import { fromConvexTuple } from "#convex/lib/result";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import {
	createAndSendStripeInvoice,
	type StripeInvoiceLineItem,
	validateStripeInvoiceLineItems
} from "#convex/lib/stripe/stripeInvoice";
import { getStripeClient, type StripeClient } from "#convex/lib/stripe/stripeClient";

type StripeInvoiceSenderIdentity = { email?: string };

function requireStripeCustomerId(stripeCustomerId: string | undefined) {
	if (!stripeCustomerId) {
		return err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
	}

	return ok(stripeCustomerId);
}

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
): ResultAsync<
	{ identity: { email?: string }; lineItems: StripeInvoiceLineItem[] },
	{ reason: string }
> {
	return requirePermissionActions(ctx, "send:receipt-emails").andThen((identity) =>
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
		requireStripeCustomerId(session.stripeCustomerId)
	);
}

export function loadPackageStripeCustomerId(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<string, { reason: string }> {
	return getPackageForAction(ctx, packageId).andThen((packageRecord) =>
		requireStripeCustomerId(packageRecord.stripeCustomerId)
	);
}

export function createAndRecordBookingStripeInvoice(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string,
	stripe?: StripeClient
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return createAndSendStripeInvoice(stripe ?? getStripeClient(), {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "booking", bookingId: args.bookingId, requestId: args.requestId }
	}).andThen(({ stripeInvoiceId }) =>
		fromConvexTuple(
			ctx.runMutation(internal.stripeInvoices.recordBookingStripeInvoice, {
				bookingId: args.bookingId,
				stripeInvoiceId,
				lineItems: args.lineItems,
				requestId: args.requestId,
				createdBy: identity.email
			})
		).map(() => ({ stripeInvoiceId }))
	);
}

export function createAndRecordPackageStripeInvoice(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string,
	stripe?: StripeClient
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return createAndSendStripeInvoice(stripe ?? getStripeClient(), {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "package", packageId: args.packageId, requestId: args.requestId }
	}).andThen(({ stripeInvoiceId }) =>
		fromConvexTuple(
			ctx.runMutation(internal.stripeInvoices.recordPackageStripeInvoice, {
				packageId: args.packageId,
				stripeInvoiceId,
				lineItems: args.lineItems,
				requestId: args.requestId,
				createdBy: identity.email
			})
		).map(() => ({ stripeInvoiceId }))
	);
}
