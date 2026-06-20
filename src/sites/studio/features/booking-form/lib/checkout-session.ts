import type { Id } from "#convex/_generated/dataModel";

export interface EmbeddedCheckoutSession {
	bookingId: Id<"bookings">;
	clientSecret: string;
	stripeSessionId: string;
}
