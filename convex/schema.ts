import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { SERVICES } from "../src/sites/studio/features/booking-form/lib/booking-form-model";

const bookingInvoiceLineItemsValidator = v.array(
	v.object({ amount: v.number(), description: v.string(), quantity: v.number(), rate: v.number() })
);

const packageReminderTypeValidator = v.union(v.literal("payment"), v.literal("expiry"));
const packageReminderStateValidator = v.union(
	v.object({
		type: packageReminderTypeValidator,
		status: v.literal("claimed"),
		claimedAt: v.number()
	}),
	v.object({ type: packageReminderTypeValidator, status: v.literal("sent"), sentAt: v.number() }),
	v.object({
		type: packageReminderTypeValidator,
		status: v.literal("failed"),
		failureCode: v.string()
	})
);
export default defineSchema({
	editorProfiles: defineTable({
		// Convex's canonical auth key combines the token issuer and subject, avoiding cross-issuer collisions.
		tokenIdentifier: v.string(),
		displayName: v.string(),
		email: v.string(),
		isActive: v.boolean(),
		lastAssignedAt: v.union(v.number(), v.null()),
		notes: v.optional(v.string())
	})
		.index("by_tokenIdentifier", ["tokenIdentifier"])
		.index("by_isActive", ["isActive"]),

	bookingSettings: defineTable({
		key: v.string(),
		leadTimeMinutes: v.number(),
		eventBufferMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ startTime: v.string(), endTime: v.string() })),
		updatedAt: v.number(),
		updatedBy: v.optional(v.string())
	}).index("by_key", ["key"]),

	packageAdjustments: defineTable(
		v.union(
			v.object({
				outcome: v.literal("no_charge"),
				multiBookingId: v.id("multiBookingPackages"),
				trigger: v.union(v.literal("all_sessions_completed"), v.literal("package_expired")),
				remotePodcastBookingIds: v.array(v.id("bookings")),
				quantity: v.literal(0),
				rate: v.number(),
				totalAmount: v.literal(0),
				createdAt: v.number()
			}),
			v.object({
				outcome: v.literal("invoice_required"),
				multiBookingId: v.id("multiBookingPackages"),
				trigger: v.union(v.literal("all_sessions_completed"), v.literal("package_expired")),
				remotePodcastBookingIds: v.array(v.id("bookings")),
				quantity: v.number(),
				rate: v.number(),
				totalAmount: v.number(),
				invoiceNumber: v.string(),
				createdAt: v.number(),
				invoiceDueAt: v.number(),
				invoiceEmailStatus: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
				invoiceEmailClaimedAt: v.optional(v.number()),
				paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"))
			})
		)
	).index("by_multiBookingId", ["multiBookingId"]),

	customInvoices: defineTable({
		bookingId: v.optional(v.id("bookings")),
		multiBookingId: v.optional(v.id("multiBookingPackages")),
		invoiceNumber: v.string(),
		dueDate: v.optional(v.string()),
		service: v.optional(v.string()),
		duration: v.optional(v.string()),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		completeEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		handcraftedClipsQuantity: v.optional(v.string()),
		packageSize: v.optional(v.union(v.literal(4), v.literal(8), v.literal(12))),
		includeDepositLineItem: v.boolean(),
		includePackageDiscount: v.optional(v.boolean()),
		customTotalDueAmount: v.optional(v.number()),
		createdAt: v.number(),
		createdBy: v.optional(v.string())
	})
		.index("by_bookingId", ["bookingId"])
		.index("by_multiBookingId", ["multiBookingId"]),

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
		completeEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		handcraftedClipsQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),

		// Booking/payment lifecycle
		status: v.union(
			v.literal("pending_payment"),
			v.literal("confirmed"),
			v.literal("cancelled"),
			v.literal("failed"),
			v.literal("email_failed"),
			v.literal("expired"),
			v.literal("abandoned")
		),
		pendingPaymentCreatedAt: v.number(),
		paymentCompletedAt: v.optional(v.number()),
		bookingConfirmedAt: v.optional(v.number()),
		bookingFailureCode: v.optional(v.string()),

		hiddenAt: v.optional(v.number()),
		// Confirmation email claim state
		bookingConfirmationClaimedAt: v.optional(v.number()),
		bookingConfirmationEventId: v.optional(v.string()),
		// Temporarily holds a target session window while its Calendar event is changed.
		reservationCreatedAt: v.optional(v.number()),
		reservationSessionStartAt: v.optional(v.number()),
		reservationDuration: v.optional(v.string()),

		// Reminder email state
		reminderEmailClaimedAt: v.optional(v.number()),
		reminderEmailSentAt: v.optional(v.number()),
		reminderEmailFailureCode: v.optional(v.string()),

		// Editor assignment
		assignedEditorTokenIdentifier: v.optional(v.string()),

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
		multiBookingPackageId: v.optional(v.id("multiBookingPackages"))
	})
		.index("by_pendingPaymentCreatedAt", ["pendingPaymentCreatedAt"])
		.index("by_stripeSessionId", ["stripeSessionId"])
		.index("by_status_and_sessionStartAt", ["status", "sessionStartAt"])
		.index("by_status_and_reminderEmailSentAt_and_sessionStartAt", [
			"status",
			"reminderEmailSentAt",
			"sessionStartAt"
		])
		.index("by_status_and_pendingPaymentCreatedAt", ["status", "pendingPaymentCreatedAt"])
		.index("by_reservationCreatedAt", ["reservationCreatedAt"])
		.index("by_assignedEditorTokenIdentifier", ["assignedEditorTokenIdentifier"])
		.index("by_multiBookingPackageId", ["multiBookingPackageId"])
		.index("by_multiBookingPackageId_and_status_and_sessionStartAt", [
			"multiBookingPackageId",
			"status",
			"sessionStartAt"
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
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		completeEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		handcraftedClipsQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		defaultSpace: v.optional(v.union(...SERVICES.map((service) => v.literal(service)))),

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
			v.literal("schedule_email_failed")
		),
		createdAt: v.number(),
		invoiceDueAt: v.number(),
		paidAt: v.optional(v.number()),
		expiresAt: v.optional(v.number()),
		hiddenAt: v.optional(v.number()),

		// Invoice metadata/email status
		invoiceNumber: v.optional(v.string()),
		invoiceEmailStatus: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
		invoiceEmailSentAt: v.optional(v.number()),
		invoiceEmailFailureCode: v.optional(v.string()),
		lastInvoiceEmailAttemptAt: v.optional(v.number()),

		// Reminder state for the package's current payment or expiry lifecycle stage
		packageReminderState: v.optional(packageReminderStateValidator),

		// Scheduling link
		scheduleTokenHash: v.optional(v.string()),
		scheduleLinkStatus: v.optional(
			v.union(v.literal("active"), v.literal("expired"), v.literal("disabled"))
		)
	})
		.index("by_status_and_invoiceDueAt", ["status", "invoiceDueAt"])
		.index("by_status_and_expiresAt", ["status", "expiresAt"])
		.index("by_createdAt", ["createdAt"])
		.index("by_scheduleTokenHash", ["scheduleTokenHash"])
});
