"use node";

import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { fromConvexTuple } from "#convex/lib/result";
import { createAndSendPackageAdjustmentStripeInvoice } from "#convex/lib/stripe/stripeAdjustmentInvoice";
import { getStripeClient, type StripeClient } from "#convex/lib/stripe/stripeClient";

export type SendPackageAdjustmentInvoiceArgs = {
	adjustmentId: Id<"packageAdjustments">;
	attempt: "automatic" | "retry";
};

type PackageAdjustmentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

type PackageAdjustmentInvoiceSendFailure =
	| { reason: "STRIPE_CUSTOMER_NOT_FOUND" }
	| { reason: "STRIPE_ADJUSTMENT_INVOICE_FAILED" };

type SendPackageAdjustmentInvoiceError =
	| PackageAdjustmentClaimError
	| PackageAdjustmentInvoiceSendFailure;

function markPackageAdjustmentInvoiceEmailFailed<T extends PackageAdjustmentInvoiceSendFailure>(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number },
	failure: T
): NeverthrowResultAsync<never, T> {
	return fromConvexTuple<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, args)
	)
		.orElse(() => ok(null))
		.andThen(() => err(failure));
}

export function sendPackageAdjustmentInvoiceService(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	stripe: StripeClient = getStripeClient()
): NeverthrowResultAsync<null, SendPackageAdjustmentInvoiceError> {
	const claimedAt = Date.now();

	return (
		fromConvexTuple<
			Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
		>(
			ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
				adjustmentId: args.adjustmentId,
				attempt: args.attempt,
				now: claimedAt
			})
		)
			// Create and send the claimed adjustment invoice through Stripe.
			.andThen((invoiceInput) => {
				const { adjustment, packageRecord } = invoiceInput;

				if (!packageRecord.stripeCustomerId) {
					return markPackageAdjustmentInvoiceEmailFailed(
						ctx,
						{ adjustmentId: args.adjustmentId, claimedAt },
						{ reason: "STRIPE_CUSTOMER_NOT_FOUND" }
					);
				}

				return createAndSendPackageAdjustmentStripeInvoice(stripe, {
					adjustmentId: args.adjustmentId,
					packageId: packageRecord._id,
					stripeCustomerId: packageRecord.stripeCustomerId,
					quantity: adjustment.quantity
				})
					.orElse((stripeFailure) =>
						markPackageAdjustmentInvoiceEmailFailed(
							ctx,
							{ adjustmentId: args.adjustmentId, claimedAt },
							stripeFailure
						)
					)
					.andThen(({ stripeInvoiceId }) =>
						fromConvexTuple<
							Promise<
								ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>
							>
						>(
							ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
								adjustmentId: args.adjustmentId,
								claimedAt,
								stripeInvoiceId
							})
						).map(() => null)
					);
			})
	);
}

export function retryPackageAdjustmentInvoiceEmailService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
): NeverthrowResultAsync<
	null,
	SendPackageAdjustmentInvoiceError | { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" }
> {
	return requirePermissionActions(ctx, "send:receipt-emails").andThen(() =>
		sendPackageAdjustmentInvoiceService(ctx, { ...args, attempt: "retry" })
	);
}
