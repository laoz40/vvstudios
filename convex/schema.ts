import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { SERVICES } from "../src/sites/studio/features/booking-form/lib/booking-form-model";

const bookingInvoiceLineItemsValidator = v.array(
	v.object({ amount: v.number(), description: v.string(), quantity: v.number(), rate: v.number() })
);

const driveFolderValidator = v.object({ id: v.string(), url: v.string() });
const drivePermissionValidator = v.object({
	id: v.string(),
	emailAddress: v.string(),
	role: v.union(v.literal("reader"), v.literal("writer"), v.literal("commenter"))
});
const clientDrivePermissionsStatusValidator = v.union(v.literal("ready"), v.literal("failed"));
const assetsEmailStatusValidator = v.union(v.literal("sent"), v.literal("failed"));
const editorDrivePermissionsStatusValidator = v.union(v.literal("ready"), v.literal("failed"));
const assignmentEmailStatusValidator = v.union(v.literal("sent"), v.literal("failed"));
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
		tokenIdentifier: v.string(),
		displayName: v.string(),
		email: v.string(),
		isActive: v.boolean(),
		lastAssignedAt: v.union(v.number(), v.null()),
		totalEdits: v.number(),
		notes: v.optional(v.string())
	})
		.index("by_tokenIdentifier", ["tokenIdentifier"])
		.index("by_isActive", ["isActive"]),

	driveClients: defineTable({
		normalizedEmail: v.string(),
		displayName: v.string(),
		// Folder data is absent until the client's Google folder is created by Drive setup.
		folderId: v.optional(v.string()),
		folderUrl: v.optional(v.string()),
		assetsFolder: v.optional(driveFolderValidator),
		clientFolderPermission: v.optional(drivePermissionValidator),
		assetsClientPermission: v.optional(drivePermissionValidator),
		createdAt: v.number()
	}).index("by_normalizedEmail", ["normalizedEmail"]),

	driveClientEditorPermissions: defineTable({
		driveClientId: v.id("driveClients"),
		editorTokenIdentifier: v.string(),
		assetsPermission: drivePermissionValidator,
		createdAt: v.number(),
		updatedAt: v.number()
	}).index("by_driveClientId_and_editorTokenIdentifier", [
		"driveClientId",
		"editorTokenIdentifier"
	]),

	driveSessions: defineTable({
		bookingId: v.id("bookings"),
		driveClientId: v.id("driveClients"),
		packageSessionNumber: v.optional(v.number()),
		packageFolder: v.optional(driveFolderValidator),
		sessionFolder: v.optional(driveFolderValidator),
		rawMediaFolder: v.optional(driveFolderValidator),
		deliverablesFolder: v.optional(driveFolderValidator),
		clientDrivePermissionsStatus: v.optional(clientDrivePermissionsStatusValidator),
		assetsEmailStatus: v.optional(assetsEmailStatusValidator),
		assetsEmailFolderId: v.optional(v.string()),
		assetsEmailClaimedAt: v.optional(v.number()),
		editorDrivePermissionsStatus: v.optional(editorDrivePermissionsStatusValidator),
		editorDrivePermissionsTokenIdentifier: v.optional(v.string()),
		editorSessionPermission: v.optional(drivePermissionValidator),
		editorDeliverablesPermission: v.optional(drivePermissionValidator),
		assignmentEmailStatus: v.optional(assignmentEmailStatusValidator),
		assignmentEmailTokenIdentifier: v.optional(v.string()),
		assignmentEmailClaimedAt: v.optional(v.number()),
		failedRemovalEditorTokenIdentifier: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number()
	}).index("by_bookingId", ["bookingId"]),

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
		bookingConfirmationClaimedAt: v.optional(v.number()),
		bookingConfirmationEventId: v.optional(v.string()),
		reservationCreatedAt: v.optional(v.number()),
		reservationSessionStartAt: v.optional(v.number()),
		reservationDuration: v.optional(v.string()),

		// Reminder email state
		reminderEmailClaimedAt: v.optional(v.number()),
		reminderEmailSentAt: v.optional(v.number()),
		reminderEmailFailureCode: v.optional(v.string()),

		// Editor assignment and internal editing instructions
		assignedEditorTokenIdentifier: v.optional(v.string()),
		adminNotes: v.optional(v.string()),
		editorNotes: v.optional(v.string()),
		deliverablesClientNotes: v.optional(v.string()),
		deliverablesDriveLink: v.optional(v.string()),

		// Drive client record created/reused at booking creation; its folder is created by setup later.
		driveClientId: v.optional(v.id("driveClients")),

		// Remaining balance/admin edit state
		paidRemainingBalance: v.optional(v.boolean()),
		remainingBalanceAmount: v.optional(v.number()),
		editStatus: v.optional(
			v.union(
				v.literal("to_edit"),
				v.literal("editing"),
				v.literal("review"),
				v.literal("completed")
			)
		),

		// Stripe data
		stripeSessionId: v.optional(v.string()),
		stripePaymentIntentId: v.optional(v.string()),

		// Google Calendar data
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),

		// Multi-booking package link, when this booking is one scheduled package session
		multiBookingPackageId: v.optional(v.id("multiBookingPackages")),

		// Admin-visible Drive setup failure state. A manual retry clears it after setup succeeds.
		driveSetupFailedAt: v.optional(v.number()),
		driveSetupFailureCode: v.optional(v.string())
	})
		.index("by_email", ["email"])
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
		.index("by_assignedEditorTokenIdentifier_and_driveClientId", [
			"assignedEditorTokenIdentifier",
			"driveClientId"
		])
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
