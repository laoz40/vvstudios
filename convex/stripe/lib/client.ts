"use node";

import Stripe from "stripe";
import { env } from "#convex/env";

export function getStripeClient() {
	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
}

export type StripeClient = ReturnType<typeof getStripeClient>;
