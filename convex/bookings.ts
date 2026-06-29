import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { getMultiBookingInvoiceDueAt } from "../src/sites/studio/features/booking-form/lib/booking-pricing";
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

export const listMultiBookingPackages = query({
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
	return await ctx.db
		.query("bookings")
		.withIndex("by_pendingPaymentCreatedAt")
		.order("desc")
		.paginate(args.paginationOpts);
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
