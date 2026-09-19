import type { Id } from "#convex/_generated/dataModel";

export type EmbeddedCheckoutSession =
	| { kind: "session"; bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string }
	| { kind: "package"; packageId: Id<"packages">; clientSecret: string; stripeSessionId: string };
