import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const bookingInvoiceLineItemsValidator = v.array(
	v.object({ amount: v.number(), description: v.string(), quantity: v.number(), rate: v.number() })
);
export default defineSchema({
	bookingSettings: defineTable({
		key: v.string(),
		leadTimeMinutes: v.number(),
		eventBufferMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ startTime: v.string(), endTime: v.string() })),
		updatedAt: v.number(),
		updatedBy: v.optional(v.string())
	}).index("by_key", ["key"]),

	customInvoices: defineTable({
		bookingId: v.id("bookings"),
		invoiceNumber: v.string(),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		includeDepositLineItem: v.boolean(),
		createdAt: v.number(),
		createdBy: v.optional(v.string())
	}).index("by_bookingId", ["bookingId"]),

	bookingRescheduleLinks: defineTable({
		bookingId: v.id("bookings"),
		tokenHash: v.string(),
		status: v.union(v.literal("active"), v.literal("used"), v.literal("expired")),
		expiresAt: v.number(),
		usedAt: v.optional(v.number()),
		createdAt: v.number()
	})
		.index("by_tokenHash", ["tokenHash"])
		.index("by_bookingId_and_status", ["bookingId", "status"]),

	bookings: defineTable({
		// Customer/contact fields
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		instagramHandle: v.optional(v.string()),

		// Scheduled session
		date: v.string(),
		time: v.string(),
		sessionStartAt: v.number(),

		// Session booking details
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),

		// Booking/payment lifecycle
		status: v.union(
			v.literal("pending_payment"),
			v.literal("confirmed"),
			v.literal("failed"),
			v.literal("email_failed"),
			v.literal("expired"),
			v.literal("abandoned")
		),
		pendingPaymentCreatedAt: v.number(),
		paymentCompletedAt: v.optional(v.number()),
		bookingConfirmedAt: v.optional(v.number()),
		bookingFailureCode: v.optional(v.string()),

		// Confirmation email claim state
		bookingConfirmationClaimedAt: v.optional(v.number()),
		bookingConfirmationEventId: v.optional(v.string()),

		// Reminder email state
		reminderEmailClaimedAt: v.optional(v.number()),
		reminderEmailSentAt: v.optional(v.number()),
		reminderEmailFailureCode: v.optional(v.string()),

		// Remaining balance/admin edit state
		paidRemainingBalance: v.optional(v.boolean()),
		remainingBalanceAmount: v.optional(v.number()),
		editStatus: v.optional(
			v.union(v.literal("to_edit"), v.literal("editing"), v.literal("completed"))
		),

		// Stripe data
		stripeSessionId: v.optional(v.string()),
		stripePaymentIntentId: v.optional(v.string()),

		// Google Calendar data
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),

		// Multi-booking package link, when this booking is one scheduled package session
		multiBookingPackageId: v.optional(v.id("multiBookingPackages")),
		multiBookingSlotNumber: v.optional(v.number())
	})
		.index("by_pendingPaymentCreatedAt", ["pendingPaymentCreatedAt"])
		.index("by_stripeSessionId", ["stripeSessionId"])
		.index("by_status_and_sessionStartAt", ["status", "sessionStartAt"])
		.index("by_status_and_pendingPaymentCreatedAt", ["status", "pendingPaymentCreatedAt"])
		.index("by_multiBookingPackageId", ["multiBookingPackageId"])
		.index("by_multiBookingPackageId_and_multiBookingSlotNumber", [
			"multiBookingPackageId",
			"multiBookingSlotNumber"
		]),

	multiBookingPackages: defineTable({
		// Customer/contact fields
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		instagramHandle: v.optional(v.string()),

		// Package booking details
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),

		// Package invoice amount snapshot
		singleSessionAmount: v.number(),
		packageSubtotalAmount: v.number(),
		discountPercent: v.number(),
		discountAmount: v.number(),
		totalDueAmount: v.number(),
		invoiceLineItems: v.optional(bookingInvoiceLineItemsValidator),

		// Package/payment lifecycle
		status: v.union(
			v.literal("pending_payment"),
			v.literal("paid"),
			v.literal("invoice_email_failed"),
			v.literal("schedule_email_failed"),
			v.literal("cancelled")
		),
		createdAt: v.number(),
		invoiceDueAt: v.number(),
		paidAt: v.optional(v.number()),
		expiresAt: v.optional(v.number()),
		hiddenAt: v.optional(v.number()),
		cancelledAt: v.optional(v.number()),

		// Invoice metadata/email status
		invoiceNumber: v.optional(v.string()),
		invoiceEmailStatus: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
		invoiceEmailSentAt: v.optional(v.number()),
		invoiceEmailFailureCode: v.optional(v.string()),
		lastInvoiceEmailAttemptAt: v.optional(v.number()),

		// Scheduling link
		scheduleTokenHash: v.optional(v.string()),
		scheduleLinkStatus: v.optional(
			v.union(v.literal("active"), v.literal("expired"), v.literal("disabled"))
		),

		// Bounded package slots. Date/time/calendar data lives on linked bookings.
		sessions: v.array(
			v.object({
				slotNumber: v.number(),
				bookingId: v.optional(v.id("bookings")),
				scheduledAt: v.optional(v.number()),
				cancelledAt: v.optional(v.number())
			})
		)
	})
		.index("by_status_and_invoiceDueAt", ["status", "invoiceDueAt"])
		.index("by_scheduleTokenHash", ["scheduleTokenHash"])
});
