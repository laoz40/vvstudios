import Stripe from "stripe";

export type StripeApiFailure = { reason: string };

export function stripeApiFailureReason(cause: unknown): StripeApiFailure {
	if (cause instanceof Stripe.errors.StripeError) {
		const code = cause.code?.trim();

		if (code) {
			return { reason: `STRIPE_${code.toUpperCase().replaceAll("-", "_")}` };
		}

		const typeSuffix = cause.type.replace(/^Stripe/, "").replace(/Error$/, "");

		if (typeSuffix) {
			return { reason: `STRIPE_${typeSuffix.toUpperCase()}` };
		}
	}

	console.error("Stripe API call failed", { cause });

	return { reason: "STRIPE_API_FAILED" };
}
