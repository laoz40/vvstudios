"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { fromConvexTuple } from "#convex/lib/result";
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
	stripe?: StripeClient
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen((identity) =>
			validateStripeInvoiceLineItems(args.lineItems).map((lineItems) => ({ identity, lineItems }))
		)
		.andThen(({ identity, lineItems }) =>
			getSessionFromQuery(ctx, args.bookingId).andThen((session) =>
				requireStripeCustomerId(session.stripeCustomerId).map((stripeCustomerId) => ({
					identity,
					lineItems,
					stripeCustomerId
				}))
			)
		)
		.andThen(({ identity, lineItems, stripeCustomerId }) =>
			createAndSendStripeInvoice(stripe ?? getStripeClient(), {
				stripeCustomerId,
				lineItems,
				metadata: { kind: "booking", bookingId: args.bookingId, requestId: args.requestId }
			}).andThen(({ stripeInvoiceId }) =>
				fromConvexTuple(
					ctx.runMutation(internal.stripeInvoices.recordBookingStripeInvoice, {
						bookingId: args.bookingId,
						stripeInvoiceId,
						lineItems,
						requestId: args.requestId,
						createdBy: identity.email
					})
				).map(() => ({ stripeInvoiceId }))
			)
		);
}

export function sendPackageStripeInvoiceService(
	ctx: ActionCtx,
	args: SendPackageStripeInvoiceArgs,
	stripe?: StripeClient
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen((identity) =>
			validateStripeInvoiceLineItems(args.lineItems).map((lineItems) => ({ identity, lineItems }))
		)
		.andThen(({ identity, lineItems }) =>
			getPackageForAction(ctx, args.packageId).andThen((packageRecord) =>
				requireStripeCustomerId(packageRecord.stripeCustomerId).map((stripeCustomerId) => ({
					identity,
					lineItems,
					stripeCustomerId
				}))
			)
		)
		.andThen(({ identity, lineItems, stripeCustomerId }) =>
			createAndSendStripeInvoice(stripe ?? getStripeClient(), {
				stripeCustomerId,
				lineItems,
				metadata: { kind: "package", packageId: args.packageId, requestId: args.requestId }
			}).andThen(({ stripeInvoiceId }) =>
				fromConvexTuple(
					ctx.runMutation(internal.stripeInvoices.recordPackageStripeInvoice, {
						packageId: args.packageId,
						stripeInvoiceId,
						lineItems,
						requestId: args.requestId,
						createdBy: identity.email
					})
				).map(() => ({ stripeInvoiceId }))
			)
		);
}
