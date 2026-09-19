"use node";

import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	getStripeInvoiceBillingUrls,
	type StripeInvoiceBillingUrls
} from "#convex/lib/stripeInvoiceBillingUrls";
import { getStripeClient, type StripeClient } from "#convex/lib/stripeClient";

type GetStripeInvoiceBillingUrlsError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "STRIPE_INVOICE_LOOKUP_FAILED" };

export function getStripeInvoiceBillingUrlsService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string },
	stripe: StripeClient = getStripeClient()
): ResultAsync<StripeInvoiceBillingUrls, GetStripeInvoiceBillingUrlsError> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data").andThen(() =>
		getStripeInvoiceBillingUrls(stripe, args.stripeInvoiceId)
	);
}
