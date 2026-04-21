import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	bookings: defineTable({
		// Booking form data
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		notes: v.optional(v.string()),

		// Booking/payment lifecycle
		status: v.union(
			v.literal("pending_payment"),
			v.literal("confirmed"),
			v.literal("failed"),
			v.literal("expired"),
		),
		pendingPaymentCreatedAt: v.number(),
		paymentCompletedAt: v.optional(v.number()),
		checkoutExpiredAt: v.optional(v.number()),
		bookingConfirmationClaimedAt: v.optional(v.number()),
		bookingConfirmationEventId: v.optional(v.string()),
		bookingConfirmedAt: v.optional(v.number()),
		bookingFailureCode: v.optional(v.string()),

		// Stripe data
		stripeSessionId: v.optional(v.string()),
		stripePaymentIntentId: v.optional(v.string()),

		// Google Calendar data
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
	})
		.index("by_pendingPaymentCreatedAt", ["pendingPaymentCreatedAt"])
		.index("by_stripeSessionId", ["stripeSessionId"]),
});
