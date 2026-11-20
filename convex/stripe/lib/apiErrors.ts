import StripeSdk from "stripe";

export type StripeApiFailure = { reason: string };

export function isExpectedStripeError(cause: unknown) {
	return cause instanceof StripeSdk.errors.StripeCardError;
}

export function stripeApiFailureReason(cause: unknown): StripeApiFailure {
	if (!(cause instanceof StripeSdk.errors.StripeError)) return { reason: "STRIPE_API_FAILED" };

	const code = cause.code?.trim();

	if (code) return { reason: `STRIPE_${code.toUpperCase().replaceAll("-", "_")}` };

	const typeSuffix = cause.type.replace(/^Stripe/, "").replace(/Error$/, "");

	if (typeSuffix) return { reason: `STRIPE_${typeSuffix.toUpperCase()}` };

	return { reason: "STRIPE_API_FAILED" };
}
