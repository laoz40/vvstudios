"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";
import {
	createAndSendStripeInvoice,
	type StripeInvoiceLineItem,
	validateStripeInvoiceLineItems
} from "#convex/lib/stripeInvoice";
import { getStripeClient, type StripeClient } from "#convex/lib/stripeClient";

type SendStripeInvoiceArgs = { lineItems: StripeInvoiceLineItem[]; requestId: string };

type SendBookingStripeInvoiceArgs = SendStripeInvoiceArgs & { bookingId: Id<"bookings"> };

type SendPackageStripeInvoiceArgs = SendStripeInvoiceArgs & { packageId: Id<"packages"> };

function requireStripeCustomerId(stripeCustomerId: string | undefined) {
	if (!stripeCustomerId) {
		return err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
	}

	return ok(stripeCustomerId);
}

export function sendBookingStripeInvoiceService(
	ctx: ActionCtx,
	args: SendBookingStripeInvoiceArgs,
	stripe: StripeClient = getStripeClient()
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => validateStripeInvoiceLineItems(args.lineItems))
		.andThen((lineItems) =>
			getSessionFromQuery(ctx, args.bookingId).andThen((session) =>
				requireStripeCustomerId(session.stripeCustomerId).map((stripeCustomerId) => ({
					lineItems,
					stripeCustomerId
				}))
			)
		)
		.andThen(({ lineItems, stripeCustomerId }) =>
			createAndSendStripeInvoice(stripe, {
				stripeCustomerId,
				lineItems,
				metadata: { kind: "booking", bookingId: args.bookingId, requestId: args.requestId }
			})
		);
}

export function sendPackageStripeInvoiceService(
	ctx: ActionCtx,
	args: SendPackageStripeInvoiceArgs,
	stripe: StripeClient = getStripeClient()
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => validateStripeInvoiceLineItems(args.lineItems))
		.andThen((lineItems) =>
			getPackageForAction(ctx, args.packageId).andThen((packageRecord) =>
				requireStripeCustomerId(packageRecord.stripeCustomerId).map((stripeCustomerId) => ({
					lineItems,
					stripeCustomerId
				}))
			)
		)
		.andThen(({ lineItems, stripeCustomerId }) =>
			createAndSendStripeInvoice(stripe, {
				stripeCustomerId,
				lineItems,
				metadata: { kind: "package", packageId: args.packageId, requestId: args.requestId }
			})
		);
}
