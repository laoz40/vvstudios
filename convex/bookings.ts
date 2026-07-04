import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import {
	calculateMultiBookingAmounts,
	getMultiBookingExpiresAt,
	getMultiBookingInvoiceDueAt,
	type MultiBookingSize
} from "../src/sites/studio/features/booking-form/lib/booking-pricing";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { env } from "./env";
import { getAdminIdentity } from "./lib/auth";
import { getBookingFromDb } from "./lib/bookingLookup";
import { buildAdminBookingUpdatePatch, getBookingSessionStartAt } from "./lib/bookingAdminEdit";
import { checkBookingMeetsAvailabilitySettings } from "./lib/bookingCalendarTime";
import { checkBookingSubmitRateLimit } from "./lib/rateLimits";
import type { MultiBookingInvoiceSource } from "./lib/bookingInvoiceArtifacts";
import { createMultiBookingInvoiceLineItemSnapshot } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { generateRescheduleToken, hashRescheduleToken } from "./lib/bookingRescheduleLinks";

const bookingInvoiceLineItemValidator = v.object({
	amount: v.number(),
	description: v.string(),
	quantity: v.number(),
	rate: v.number()
});

type CreatePendingBookingResult = Result<
	{ bookingId: Doc<"bookings">["_id"] },
	{
		reason:
			| "BOOKING_INVALID_DATE"
			| "BOOKING_INVALID_DURATION"
			| "BOOKING_INVALID_TIME"
			| "BOOKING_OUTSIDE_OPENING_HOURS"
			| "BOOKING_TOO_FAR_AHEAD"
			| "BOOKING_TOO_SOON";
	}
>;

export const checkBookingSubmitRateLimitInternal = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) => checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey)
});

export const createPendingBooking = internalMutation({
	args: {
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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: async (ctx, args): Promise<CreatePendingBookingResult> => {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const [availabilityError] = checkBookingMeetsAvailabilitySettings({
			date: args.date,
			duration: args.duration,
			settings,
			time: args.time,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE
		});

		if (availabilityError !== null) {
			return err({ reason: availabilityError.reason });
		}

		const [sessionStartError, sessionStartAt] = getBookingSessionStartAt(
			args.date,
			args.time,
			env.GOOGLE_CALENDAR_TIMEZONE
		);

		if (sessionStartError !== null) {
			return err({ reason: sessionStartError.reason });
		}

		const bookingId = await ctx.db.insert("bookings", {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			date: args.date,
			time: args.time,
			sessionStartAt,
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			essentialEditQuantity: args.essentialEditQuantity,
			clipsPackageQuantity: args.clipsPackageQuantity,
			notes: args.notes,
			status: "pending_payment",
			pendingPaymentCreatedAt: Date.now()
		});

		return ok({ bookingId });
	}
});

type CreatePendingMultiBookingResult = Result<
	{ multiBooking: MultiBookingInvoiceSource },
	{ reason: "PACKAGE_CREATE_FAILED" }
>;

export const createPendingMultiBooking = internalMutation({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		singleSessionAmount: v.number(),
		packageSubtotalAmount: v.number(),
		discountPercent: v.number(),
		discountAmount: v.number(),
		totalDueAmount: v.number(),
		invoiceLineItems: v.array(bookingInvoiceLineItemValidator)
	},
	handler: async (ctx, args): Promise<CreatePendingMultiBookingResult> => {
		const createdAt = Date.now();
		const invoiceDueAt = getMultiBookingInvoiceDueAt(createdAt);
		const multiBooking = {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			...(args.abn !== undefined ? { abn: args.abn } : {}),
			email: args.email,
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			...(args.essentialEditQuantity !== undefined
				? { essentialEditQuantity: args.essentialEditQuantity }
				: {}),
			...(args.clipsPackageQuantity !== undefined
				? { clipsPackageQuantity: args.clipsPackageQuantity }
				: {}),
			...(args.notes !== undefined ? { notes: args.notes } : {}),
			packageSize: args.packageSize,
			singleSessionAmount: args.singleSessionAmount,
			packageSubtotalAmount: args.packageSubtotalAmount,
			discountPercent: args.discountPercent,
			discountAmount: args.discountAmount,
			totalDueAmount: args.totalDueAmount,
			invoiceLineItems: args.invoiceLineItems,
			status: "pending_payment" as const,
			createdAt,
			invoiceDueAt,
			invoiceEmailStatus: "pending" as const,
			sessions: Array.from({ length: args.packageSize }, (_, index) => ({ slotNumber: index + 1 }))
		};

		try {
			const multiBookingId = await ctx.db.insert("multiBookingPackages", multiBooking);

			return ok({ multiBooking: { _id: multiBookingId, ...multiBooking } });
		} catch {
			return err({ reason: "PACKAGE_CREATE_FAILED" });
		}
	}
});

export const markMultiBookingInvoiceEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		invoiceNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		if (args.status === "sent" && args.invoiceNumber === undefined) {
			return err({ reason: "INVOICE_NUMBER_REQUIRED" });
		}

		if (args.status === "failed" && args.failureCode === undefined) {
			return err({ reason: "INVOICE_FAILURE_CODE_REQUIRED" });
		}

		if (args.status === "sent") {
			await ctx.db.patch(args.multiBookingId, {
				invoiceNumber: args.invoiceNumber,
				invoiceEmailStatus: args.status,
				invoiceEmailSentAt: now,
				invoiceEmailFailureCode: undefined,
				lastInvoiceEmailAttemptAt: now,
				status: "pending_payment"
			});

			return ok({ updated: true });
		}

		await ctx.db.patch(args.multiBookingId, {
			invoiceNumber: undefined,
			invoiceEmailStatus: args.status,
			invoiceEmailSentAt: undefined,
			invoiceEmailFailureCode: args.failureCode,
			lastInvoiceEmailAttemptAt: now,
			status: "invoice_email_failed"
		});

		return ok({ updated: true });
	}
});

export const listPackages = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const [authError] = await getAdminIdentity(ctx);

		if (authError !== null) {
			throw new ConvexError(authError);
		}

		return await ctx.db
			.query("multiBookingPackages")
			.withIndex("by_createdAt")
			.order("desc")
			.paginate(args.paginationOpts);
	}
});

export const updatePackageFromAdmin = mutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		expiresAt: v.optional(v.number())
	},
	handler: (ctx, args) => updatePackageFromAdminHandler(ctx, args)
});

type UpdatePackageFromAdminArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	service: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	packageSize: MultiBookingSize;
	expiresAt?: number;
};

function buildPackageSessions(
	sessions: Doc<"multiBookingPackages">["sessions"],
	packageSize: MultiBookingSize
) {
	return Array.from({ length: packageSize }, (_, index) => {
		const slotNumber = index + 1;
		return sessions.find((session) => session.slotNumber === slotNumber) ?? { slotNumber };
	});
}

async function updatePackageFromAdminHandler(ctx: MutationCtx, args: UpdatePackageFromAdminArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const bookedSessions = multiBooking.sessions.filter(
		(session) => session.bookingId !== undefined && session.cancelledAt === undefined
	).length;

	if (args.packageSize < bookedSessions) {
		return err({ reason: "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" });
	}

	if (args.expiresAt !== undefined && !Number.isFinite(args.expiresAt)) {
		return err({ reason: "PACKAGE_INVALID_EXPIRY" });
	}

	const amounts = calculateMultiBookingAmounts({
		addons: args.addons as Parameters<typeof calculateMultiBookingAmounts>[0]["addons"],
		clipsPackageQuantity: args.clipsPackageQuantity as Parameters<
			typeof calculateMultiBookingAmounts
		>[0]["clipsPackageQuantity"],
		duration: args.duration as Parameters<typeof calculateMultiBookingAmounts>[0]["duration"],
		essentialEditQuantity: args.essentialEditQuantity as Parameters<
			typeof calculateMultiBookingAmounts
		>[0]["essentialEditQuantity"],
		packageSize: args.packageSize
	});
	const invoiceLineItems = createMultiBookingInvoiceLineItemSnapshot({
		addons: args.addons as Parameters<
			typeof createMultiBookingInvoiceLineItemSnapshot
		>[0]["addons"],
		clipsPackageQuantity: args.clipsPackageQuantity as Parameters<
			typeof createMultiBookingInvoiceLineItemSnapshot
		>[0]["clipsPackageQuantity"],
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: args.duration as Parameters<
			typeof createMultiBookingInvoiceLineItemSnapshot
		>[0]["duration"],
		essentialEditQuantity: args.essentialEditQuantity as Parameters<
			typeof createMultiBookingInvoiceLineItemSnapshot
		>[0]["essentialEditQuantity"],
		packageSize: args.packageSize,
		service: args.service as Parameters<
			typeof createMultiBookingInvoiceLineItemSnapshot
		>[0]["service"]
	});

	try {
		await ctx.db.patch(args.multiBookingId, {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			essentialEditQuantity: args.essentialEditQuantity,
			clipsPackageQuantity: args.clipsPackageQuantity,
			notes: args.notes,
			packageSize: args.packageSize,
			expiresAt: args.expiresAt,
			singleSessionAmount: amounts.singleSessionAmount,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount: amounts.totalDueAmount,
			invoiceLineItems,
			sessions: buildPackageSessions(multiBooking.sessions, args.packageSize)
		});
	} catch {
		return err({ reason: "PACKAGE_UPDATE_FAILED" });
	}

	return ok({ saved: true });
}

export type UpdatePackageFromAdminResult = Awaited<
	ReturnType<typeof updatePackageFromAdminHandler>
>;

export const archivePackage = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), archived: v.boolean() },
	handler: (ctx, args) => archivePackageHandler(ctx, args)
});

async function archivePackageHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; archived: boolean }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	try {
		await ctx.db.patch(args.multiBookingId, { hiddenAt: args.archived ? Date.now() : undefined });
	} catch {
		return err({ reason: "PACKAGE_ARCHIVE_FAILED" });
	}

	return ok({ archived: args.archived });
}

export type ArchivePackageResult = Awaited<ReturnType<typeof archivePackageHandler>>;

export const markPackagePaymentStatus = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paid: v.boolean() },
	handler: (ctx, args) => markPackagePaymentStatusHandler(ctx, args)
});

async function markPackagePaymentStatusHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; paid: boolean }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (args.paid) {
		return err({ reason: "PACKAGE_PAYMENT_CONFIRMATION_REQUIRED" });
	}

	try {
		await ctx.db.patch(args.multiBookingId, {
			paidAt: undefined,
			expiresAt: undefined,
			scheduleTokenHash: undefined,
			scheduleLinkStatus: undefined,
			status:
				multiBooking.invoiceEmailStatus === "failed" ? "invoice_email_failed" : "pending_payment"
		});
	} catch {
		return err({ reason: "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED" });
	}

	return ok({ paid: false });
}

export type MarkPackagePaymentStatusResult = Awaited<
	ReturnType<typeof markPackagePaymentStatusHandler>
>;

export const markPackagePaidAndCreateScheduleTokenInternal = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paidAt: v.number() },
	handler: (ctx, args) => markPackagePaidAndCreateScheduleTokenInternalHandler(ctx, args)
});

async function markPackagePaidAndCreateScheduleTokenInternalHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; paidAt: number }
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status === "paid" || multiBooking.status === "schedule_email_failed") {
		return err({ reason: "PACKAGE_ALREADY_PAID" });
	}

	if (multiBooking.status !== "pending_payment" && multiBooking.status !== "invoice_email_failed") {
		return err({ reason: "PACKAGE_NOT_UNPAID" });
	}

	const token = generateRescheduleToken();
	const scheduleTokenHash = await hashRescheduleToken(token);
	const expiresAt = getMultiBookingExpiresAt(args.paidAt, multiBooking.packageSize);

	try {
		await ctx.db.patch(args.multiBookingId, {
			expiresAt,
			paidAt: args.paidAt,
			scheduleLinkStatus: "active",
			scheduleTokenHash,
			status: "schedule_email_failed"
		});
	} catch {
		return err({ reason: "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED" });
	}

	return ok({
		expiresAt,
		multiBooking: {
			...multiBooking,
			expiresAt,
			paidAt: args.paidAt,
			scheduleLinkStatus: "active" as const,
			scheduleTokenHash,
			status: "schedule_email_failed" as const
		},
		token
	});
}

export type MarkPackagePaidAndCreateScheduleTokenInternalResult = Awaited<
	ReturnType<typeof markPackagePaidAndCreateScheduleTokenInternalHandler>
>;

export const refreshPackageScheduleTokenInternal = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => refreshPackageScheduleTokenInternalHandler(ctx, args)
});

async function refreshPackageScheduleTokenInternalHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "paid" && multiBooking.status !== "schedule_email_failed") {
		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" });
	}

	if (multiBooking.paidAt === undefined || multiBooking.expiresAt === undefined) {
		return err({ reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" });
	}

	const token = generateRescheduleToken();
	const scheduleTokenHash = await hashRescheduleToken(token);

	try {
		await ctx.db.patch(args.multiBookingId, { scheduleLinkStatus: "active", scheduleTokenHash });
	} catch {
		return err({ reason: "PACKAGE_SCHEDULE_TOKEN_UPDATE_FAILED" });
	}

	return ok({
		expiresAt: multiBooking.expiresAt,
		multiBooking: { ...multiBooking, scheduleLinkStatus: "active" as const, scheduleTokenHash },
		token
	});
}

export type RefreshPackageScheduleTokenInternalResult = Awaited<
	ReturnType<typeof refreshPackageScheduleTokenInternalHandler>
>;

export const markMultiBookingScheduleEmailAttemptInternal = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: async (ctx, args) => {
		const multiBooking = await ctx.db.get(args.multiBookingId);

		if (!multiBooking) {
			return err({ reason: "PACKAGE_NOT_FOUND" });
		}

		try {
			await ctx.db.patch(args.multiBookingId, {
				status: args.status === "sent" ? "paid" : "schedule_email_failed"
			});
		} catch {
			return err({ reason: "PACKAGE_SCHEDULE_EMAIL_STATUS_UPDATE_FAILED" });
		}

		return ok({ updated: true });
	}
});

export const getBookings = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, args) => getBookingsHandler(ctx, args)
});

async function getBookingsHandler(
	ctx: QueryCtx,
	args: { paginationOpts: { numItems: number; cursor: string | null } }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		throw new ConvexError(authError);
	}

	// usePaginatedQuery requires the raw Convex PaginationResult, not our Result tuple.
	// Auth failures throw above so the hook can keep native cursor/page handling.
	const bookingsPage = await ctx.db
		.query("bookings")
		.withIndex("by_pendingPaymentCreatedAt")
		.order("desc")
		.paginate(args.paginationOpts);

	const page = await Promise.all(
		bookingsPage.page.map(async (booking) => {
			if (!booking.multiBookingPackageId) {
				return booking;
			}

			const multiBookingPackage = await ctx.db.get(booking.multiBookingPackageId);

			return {
				...booking,
				multiBookingInvoiceNumber: multiBookingPackage?.invoiceNumber,
				multiBookingPackageSize: multiBookingPackage?.packageSize
			};
		})
	);

	return { ...bookingsPage, page };
}

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function buildPublicBookingStatusResponse(booking: Doc<"bookings">) {
	return {
		_id: booking._id,
		status: booking.status,
		bookingConfirmedAt: booking.bookingConfirmedAt,
		bookingFailureCode: booking.bookingFailureCode,
		pendingPaymentCreatedAt: booking.pendingPaymentCreatedAt,
		paymentCompletedAt: booking.paymentCompletedAt,
		date: booking.date,
		time: booking.time,
		duration: booking.duration,
		service: booking.service,
		addons: booking.addons,
		essentialEditQuantity: booking.essentialEditQuantity,
		clipsPackageQuantity: booking.clipsPackageQuantity
	};
}

export const getPublicRescheduleCompleteBooking = query({
	args: { bookingId: v.string() },
	handler: (ctx, args) => getPublicRescheduleCompleteBookingHandler(ctx, args)
});

async function getPublicRescheduleCompleteBookingHandler(
	ctx: QueryCtx,
	args: { bookingId: string }
) {
	const bookingId = ctx.db.normalizeId("bookings", args.bookingId);

	if (bookingId === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	const booking = await ctx.db.get(bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(buildPublicBookingStatusResponse(booking));
}

export type GetPublicRescheduleCompleteBookingResult = Awaited<
	ReturnType<typeof getPublicRescheduleCompleteBookingHandler>
>;

export const getBookingStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();

		if (!booking) return null;

		return buildPublicBookingStatusResponse(booking);
	}
});

export const saveBookingInstagramHandle = mutation({
	args: { stripeSessionId: v.string(), instagramHandle: v.string() },
	handler: saveBookingInstagramHandleHandler
});

type SaveBookingInstagramHandleArgs = { stripeSessionId: string; instagramHandle: string };

async function saveBookingInstagramHandleHandler(
	ctx: MutationCtx,
	args: SaveBookingInstagramHandleArgs
) {
	const booking = await ctx.db
		.query("bookings")
		.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
		.unique();

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_CONFIRMED" });
	}

	try {
		await ctx.db.patch(booking._id, { instagramHandle: args.instagramHandle });
	} catch {
		return err({ reason: "BOOKING_INSTAGRAM_HANDLE_SAVE_FAILED" });
	}

	return ok({ saved: true });
}

export type SaveBookingInstagramHandleResult = Awaited<
	ReturnType<typeof saveBookingInstagramHandleHandler>
>;

export const saveMultiBookingInstagramHandle = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), instagramHandle: v.string() },
	handler: saveMultiBookingInstagramHandleHandler
});

type SaveMultiBookingInstagramHandleArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	instagramHandle: string;
};

async function saveMultiBookingInstagramHandleHandler(
	ctx: MutationCtx,
	args: SaveMultiBookingInstagramHandleArgs
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "pending_payment" && multiBooking.status !== "paid") {
		return err({ reason: "PACKAGE_NOT_ACTIVE" });
	}

	try {
		await ctx.db.patch(multiBooking._id, { instagramHandle: args.instagramHandle });
	} catch {
		return err({ reason: "PACKAGE_INSTAGRAM_HANDLE_SAVE_FAILED" });
	}

	return ok({ saved: true });
}

export type SaveMultiBookingInstagramHandleResult = Awaited<
	ReturnType<typeof saveMultiBookingInstagramHandleHandler>
>;

export const getBookingByIdInternal = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.bookingId);
	}
});

export const getBookingByStripeSessionIdInternal = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();
	}
});

export const getPackageByIdInternal = internalQuery({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.multiBookingId);
	}
});

export const listBookingsDueForReminderEmail = internalQuery({
	args: { dayStart: v.number(), dayEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const bookings = await ctx.db
			.query("bookings")
			.withIndex("by_status_and_sessionStartAt", (query) =>
				query
					.eq("status", "confirmed")
					.gte("sessionStartAt", args.dayStart)
					.lt("sessionStartAt", args.dayEnd)
			)
			.take(args.limit ?? 50);

		return bookings.filter((booking) => !booking.reminderEmailSentAt);
	}
});

export const setBookingStripeSessionId = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.bookingId, { stripeSessionId: args.stripeSessionId });
	}
});

export const markBookingExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();

		if (!booking) {
			return err({ reason: "BOOKING_NOT_FOUND" });
		}

		if (booking.status === "expired") {
			return ok({ alreadyExpired: true });
		}

		if (booking.status !== "pending_payment") {
			return err({ reason: "BOOKING_INVALID_STATUS", status: booking.status });
		}

		await ctx.db.patch(booking._id, { status: "expired" });

		return ok({ alreadyExpired: false });
	}
});

export const cleanupOldPendingAndExpiredBookings = mutation({
	args: {},
	handler: cleanupOldPendingAndExpiredBookingsHandler
});

async function cleanupOldPendingAndExpiredBookingsHandler(ctx: MutationCtx) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const pendingPaymentCutoff = Date.now() - STRIPE_CHECKOUT_SESSION_EXPIRY_MS;
	let deletedCount = 0;

	const pendingBookings = await ctx.db
		.query("bookings")
		.withIndex("by_status_and_pendingPaymentCreatedAt", (query) =>
			query.eq("status", "pending_payment").lt("pendingPaymentCreatedAt", pendingPaymentCutoff)
		)
		.take(50);

	const expiredOrAbandonedBookings = await Promise.all(
		(["expired", "abandoned"] as const).map((status) =>
			ctx.db
				.query("bookings")
				.withIndex("by_status_and_pendingPaymentCreatedAt", (query) => query.eq("status", status))
				.take(50)
		)
	);

	try {
		for (const booking of [...pendingBookings, ...expiredOrAbandonedBookings.flat()]) {
			await ctx.db.delete(booking._id);
			deletedCount += 1;
		}
	} catch {
		return err({ reason: "BOOKING_CLEANUP_FAILED" });
	}

	return ok({ deletedCount, pendingPaymentCutoff });
}

export type CleanupOldPendingAndExpiredBookingsResult = Awaited<
	ReturnType<typeof cleanupOldPendingAndExpiredBookingsHandler>
>;

export const claimBookingCompletion = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string()),
		stripeEventId: v.string()
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			return err({ reason: "BOOKING_NOT_FOUND" });
		}

		if (booking.stripeSessionId && booking.stripeSessionId !== args.stripeSessionId) {
			return err({ reason: "STRIPE_SESSION_MISMATCH" });
		}

		switch (booking.status) {
			case "confirmed":
			case "email_failed":
				return ok({ outcome: "already_confirmed" });

			case "cancelled":
				return err({ reason: "BOOKING_INVALID_STATUS", status: booking.status });

			case "expired":
				return err({ reason: "BOOKING_EXPIRED" });

			case "failed":
				return err({ reason: "BOOKING_FAILED" });

			case "abandoned":
				return err({ reason: "BOOKING_INVALID_STATUS", status: booking.status });

			case "pending_payment":
				break;

			default: {
				const _exhaustive: never = booking.status;
				return _exhaustive;
			}
		}

		if (booking.bookingConfirmationClaimedAt) {
			return ok({ outcome: "already_claimed" });
		}

		const now = Date.now();

		await ctx.db.patch(booking._id, {
			paymentCompletedAt: now,
			bookingConfirmationClaimedAt: now,
			bookingConfirmationEventId: args.stripeEventId,
			stripeSessionId: args.stripeSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId
		});

		return ok({
			outcome: "claimed",
			booking: {
				_id: booking._id,
				name: booking.name,
				phone: booking.phone,
				accountName: booking.accountName,
				abn: booking.abn,
				email: booking.email,
				date: booking.date,
				time: booking.time,
				duration: booking.duration,
				service: booking.service,
				addons: booking.addons,
				notes: booking.notes
			}
		});
	}
});

export const markBookingCompleted = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			status: "confirmed",
			googleEventId: args.googleEventId,
			googleCalendarId: args.googleCalendarId,
			bookingConfirmedAt: Date.now(),
			bookingFailureCode: undefined
		});

		return ok({ updated: true });
	}
});

export const markBookingInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			status: "email_failed",
			bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
		});

		return ok({ updated: true });
	}
});

export const markBookingInvoiceEmailSent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const [bookingError, booking] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		if (booking.status !== "email_failed") {
			return ok({ updated: false, reason: "BOOKING_NOT_EMAIL_FAILED" });
		}

		await ctx.db.patch(args.bookingId, { status: "confirmed", bookingFailureCode: undefined });

		return ok({ updated: true });
	}
});

export const markBookingCompletionFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, { status: "failed", bookingFailureCode: args.failureCode });

		return ok({ updated: true });
	}
});

export const claimBookingReminderEmail = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking || (booking.status !== "confirmed" && booking.status !== "email_failed")) {
			return err({ reason: "BOOKING_NOT_SENDABLE" });
		}

		if (booking.reminderEmailSentAt || booking.reminderEmailClaimedAt) {
			return err({ reason: "BOOKING_ALREADY_CLAIMED_OR_SENT" });
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return ok({ booking });
	}
});

export const markBookingReminderEmailSent = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return ok({ updated: true });
	}
});

export const markBookingReminderEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailFailureCode: args.failureCode
		});

		return ok({ updated: true });
	}
});

export const deletePendingBooking = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			return ok({ outcome: "not_found" });
		}

		if (booking.stripeSessionId !== args.stripeSessionId) {
			return err({ reason: "STRIPE_SESSION_MISMATCH" });
		}

		if (booking.status !== "pending_payment") {
			return ok({ outcome: "not_pending", status: booking.status });
		}

		await ctx.db.patch(args.bookingId, { status: "abandoned" });

		return ok({ outcome: "abandoned" });
	}
});

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) => archiveSessionHandler(ctx, args)
});

async function archiveSessionHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	try {
		await ctx.db.patch(args.bookingId, { hiddenAt: args.archived ? Date.now() : undefined });
	} catch {
		return err({ reason: "SESSION_ARCHIVE_FAILED" });
	}

	return ok({ archived: args.archived });
}

export type ArchiveSessionResult = Awaited<ReturnType<typeof archiveSessionHandler>>;

export const markBookingCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markBookingCalendarEventDeletedHandler(ctx, args)
});

async function markBookingCalendarEventDeletedHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	try {
		await ctx.db.patch(args.bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			status: "cancelled"
		});
	} catch {
		return err({ reason: "BOOKING_STATUS_UPDATE_FAILED" });
	}

	return ok({ cancelled: true });
}

export type MarkBookingCalendarEventDeletedResult = Awaited<
	ReturnType<typeof markBookingCalendarEventDeletedHandler>
>;

export const deleteBookingInternal = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.delete(args.bookingId);

		return ok({ deleted: true });
	}
});

export const deleteBooking = mutation({
	args: { bookingId: v.id("bookings") },
	handler: deleteBookingHandler
});

type DeleteBookingArgs = { bookingId: Id<"bookings"> };

async function deleteBookingHandler(ctx: MutationCtx, args: DeleteBookingArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromDb(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	try {
		await ctx.db.delete(booking._id);
	} catch {
		return err({ reason: "BOOKING_DELETE_FAILED" });
	}

	return ok({ deleted: true });
}

export type DeleteBookingResult = Awaited<ReturnType<typeof deleteBookingHandler>>;

export const saveAdminBookingUpdateInternal = internalMutation({
	args: {
		bookingId: v.id("bookings"),
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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		confirmBooking: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const [bookingError, booking] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}
		const [updatePatchError, updatePatch] = buildAdminBookingUpdatePatch({
			booking,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
			values: args
		});

		if (updatePatchError !== null) {
			return err(updatePatchError);
		}

		// If Google Calendar event details changed, pass IDs here so booking points at the current event.
		// Failed bookings can be promoted after a Calendar event is created.
		await ctx.db.patch(args.bookingId, {
			...updatePatch,
			...(args.googleCalendarId ? { googleCalendarId: args.googleCalendarId } : {}),
			...(args.googleEventId ? { googleEventId: args.googleEventId } : {}),
			...(args.confirmBooking
				? {
						status: "confirmed" as const,
						bookingConfirmedAt: Date.now(),
						bookingFailureCode: undefined
					}
				: {})
		});

		return ok({ saved: true });
	}
});

export const saveClientBookingRescheduleInternal = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		date: v.string(),
		time: v.string(),
		sessionStartAt: v.number(),
		confirmBooking: v.optional(v.boolean()),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			date: args.date,
			time: args.time,
			sessionStartAt: args.sessionStartAt,
			...(args.googleCalendarId ? { googleCalendarId: args.googleCalendarId } : {}),
			...(args.googleEventId ? { googleEventId: args.googleEventId } : {}),
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			...(args.confirmBooking
				? {
						status: "confirmed" as const,
						bookingConfirmedAt: Date.now(),
						bookingFailureCode: undefined
					}
				: {})
		});

		return ok({ saved: true });
	}
});

export const updateBooking = mutation({
	args: {
		bookingId: v.id("bookings"),
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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: updateBookingHandler
});

type UpdateBookingArgs = {
	bookingId: Id<"bookings">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	notes?: string;
};

async function updateBookingHandler(ctx: MutationCtx, args: UpdateBookingArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	const [updatePatchError, updatePatch] = buildAdminBookingUpdatePatch({
		booking,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		values: args
	});

	if (updatePatchError !== null) {
		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	try {
		await ctx.db.patch(args.bookingId, updatePatch);
	} catch {
		return err({ reason: "BOOKING_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingResult = Awaited<ReturnType<typeof updateBookingHandler>>;

export const updateBookingStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		status: v.union(v.literal("confirmed"), v.literal("failed"), v.literal("email_failed"))
	},
	handler: updateBookingStatusHandler
});

type UpdateBookingStatusArgs = {
	bookingId: Id<"bookings">;
	status: "confirmed" | "failed" | "email_failed";
};

async function updateBookingStatusHandler(ctx: MutationCtx, args: UpdateBookingStatusArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (!["confirmed", "failed", "email_failed"].includes(booking.status)) {
		return err({ reason: "INVALID_BOOKING_STATUS_TRANSITION" });
	}

	try {
		await ctx.db.patch(args.bookingId, { status: args.status });
	} catch {
		return err({ reason: "BOOKING_STATUS_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingStatusResult = Awaited<ReturnType<typeof updateBookingStatusHandler>>;

export const updateBookingPaidRemainingBalance = mutation({
	args: { bookingId: v.id("bookings"), paidRemainingBalance: v.boolean() },
	handler: updateBookingPaidRemainingBalanceHandler
});

type UpdateBookingPaidRemainingBalanceArgs = {
	bookingId: Id<"bookings">;
	paidRemainingBalance: boolean;
};

async function updateBookingPaidRemainingBalanceHandler(
	ctx: MutationCtx,
	args: UpdateBookingPaidRemainingBalanceArgs
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	try {
		await ctx.db.patch(booking._id, { paidRemainingBalance: args.paidRemainingBalance });
	} catch {
		return err({ reason: "BOOKING_PAID_REMAINING_BALANCE_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingPaidRemainingBalanceResult = Awaited<
	ReturnType<typeof updateBookingPaidRemainingBalanceHandler>
>;

export const updateBookingEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(v.literal("to_edit"), v.literal("editing"), v.literal("completed"))
	},
	handler: updateBookingEditStatusHandler
});

type UpdateBookingEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "completed";
};

async function updateBookingEditStatusHandler(ctx: MutationCtx, args: UpdateBookingEditStatusArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	try {
		await ctx.db.patch(booking._id, { editStatus: args.editStatus });
	} catch {
		return err({ reason: "BOOKING_EDIT_STATUS_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingEditStatusResult = Awaited<
	ReturnType<typeof updateBookingEditStatusHandler>
>;

export const updateBookingRemainingBalanceAmount = mutation({
	args: { bookingId: v.id("bookings"), remainingBalanceAmount: v.number() },
	handler: updateBookingRemainingBalanceAmountHandler
});

type UpdateBookingRemainingBalanceAmountArgs = {
	bookingId: Id<"bookings">;
	remainingBalanceAmount: number;
};

async function updateBookingRemainingBalanceAmountHandler(
	ctx: MutationCtx,
	args: UpdateBookingRemainingBalanceAmountArgs
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	try {
		await ctx.db.patch(booking._id, {
			remainingBalanceAmount: Math.max(args.remainingBalanceAmount, 0)
		});
	} catch {
		return err({ reason: "BOOKING_REMAINING_BALANCE_AMOUNT_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingRemainingBalanceAmountResult = Awaited<
	ReturnType<typeof updateBookingRemainingBalanceAmountHandler>
>;
