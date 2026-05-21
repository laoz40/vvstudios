import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	bookingSettings: defineTable({
		key: v.string(),
		leadTimeMinutes: v.number(),
		eventBufferMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ startTime: v.string(), endTime: v.string() })),
		updatedAt: v.number(),
		updatedBy: v.optional(v.string()),
	}).index("by_key", ["key"]),

	customInvoices: defineTable({
		bookingId: v.id("bookings"),
		invoiceNumber: v.string(),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		includeDepositLineItem: v.boolean(),
		createdAt: v.number(),
		createdBy: v.optional(v.string()),
	}).index("by_bookingId", ["bookingId"]),

	bookings: defineTable({
		// Booking form data
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		sessionStartAt: v.number(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		notes: v.optional(v.string()),
		instagramHandle: v.optional(v.string()),

		// Booking/payment lifecycle
		status: v.union(
			v.literal("pending_payment"),
			v.literal("confirmed"),
			v.literal("failed"),
			v.literal("expired"),
			v.literal("abandoned"),
		),
		pendingPaymentCreatedAt: v.number(),
		paymentCompletedAt: v.optional(v.number()),
		bookingConfirmationClaimedAt: v.optional(v.number()),
		bookingConfirmationEventId: v.optional(v.string()),
		bookingConfirmedAt: v.optional(v.number()),
		bookingFailureCode: v.optional(v.string()),
		reminderEmailClaimedAt: v.optional(v.number()),
		reminderEmailSentAt: v.optional(v.number()),
		reminderEmailFailureCode: v.optional(v.string()),
		paidRemainingBalance: v.optional(v.boolean()),
		remainingBalanceAmount: v.optional(v.number()),

		// Stripe data
		stripeSessionId: v.optional(v.string()),
		stripePaymentIntentId: v.optional(v.string()),

		// Google Calendar data
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
	})
		.index("by_pendingPaymentCreatedAt", ["pendingPaymentCreatedAt"])
		.index("by_stripeSessionId", ["stripeSessionId"])
		.index("by_status_and_sessionStartAt", ["status", "sessionStartAt"])
		.index("by_status_and_pendingPaymentCreatedAt", ["status", "pendingPaymentCreatedAt"]),
});
