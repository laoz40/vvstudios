import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { fromConvexTuple } from "#convex/lib/result";
import { createAndSendPackageAdjustmentStripeInvoice } from "#convex/lib/stripe/stripeAdjustmentInvoice";
import { getStripeClient } from "#convex/lib/stripe/stripeClient";

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
	| { reason: string };

function failAfterInvoiceEmailFailure<T extends PackageAdjustmentInvoiceSendFailure>(failure: T) {
	return () => err(failure);
}

function recordSentPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number
) {
	return ({ stripeInvoiceId }: { stripeInvoiceId: string }) =>
		fromConvexTuple<
			Promise<ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>>
		>(
			ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
				adjustmentId: args.adjustmentId,
				claimedAt,
				stripeInvoiceId
			})
		).map(() => null);
}

export type SendPackageAdjustmentInvoiceError =
	| PackageAdjustmentClaimError
	| PackageAdjustmentInvoiceSendFailure;

function writePackageAdjustmentInvoiceEmailFailedOnSend<
	T extends PackageAdjustmentInvoiceSendFailure
>(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number },
	failure: T
): NeverthrowResultAsync<never, T> {
	return fromConvexTuple<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, args)
	)
		.orElse(okNullAsync)
		.andThen(failAfterInvoiceEmailFailure(failure));
}

function okNullAsync() {
	return ok(null);
}

export function claimPackageAdjustmentInvoiceEmailForSend(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number
): NeverthrowResultAsync<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError> {
	return fromConvexTuple<
		Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
	>(
		ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
			adjustmentId: args.adjustmentId,
			attempt: args.attempt,
			now: claimedAt
		})
	);
}

export function createSendAndRecordPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number,
	invoiceInput: PackageAdjustmentInvoiceInput
): NeverthrowResultAsync<null, SendPackageAdjustmentInvoiceError> {
	const stripe = getStripeClient();
	const { adjustment, packageRecord } = invoiceInput;

	if (!packageRecord.stripeCustomerId) {
		return writePackageAdjustmentInvoiceEmailFailedOnSend(
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
			writePackageAdjustmentInvoiceEmailFailedOnSend(
				ctx,
				{ adjustmentId: args.adjustmentId, claimedAt },
				stripeFailure
			)
		)
		.andThen(recordSentPackageAdjustmentInvoice(ctx, args, claimedAt));
}
