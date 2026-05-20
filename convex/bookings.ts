import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { env } from "./env";
import {
	assertBookingMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
} from "./lib/bookingCalendarTime";
import { rateLimiter } from "./lib/rateLimits";

function getSessionStartAt(date: string, time: string) {
	return getUtcDateForZonedDateTime(date, time, env.GOOGLE_CALENDAR_TIMEZONE).getTime();
}

type CreatePendingBookingResult =
	| { ok: true; bookingId: Doc<"bookings">["_id"] }
	| { ok: false; code: "BOOKING_RATE_LIMITED"; retryAfter: number };

export const createPendingBooking = internalMutation({
	args: {
		submitRateLimitKey: v.string(),
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
	},
	handler: async (ctx, args): Promise<CreatePendingBookingResult> => {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		assertBookingMeetsAvailabilitySettings({
			date: args.date,
			duration: args.duration,
			settings,
			time: args.time,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		});

		const globalRateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmitGlobal");
		const rateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmit", {
			key: args.submitRateLimitKey,
		});

		if (!globalRateLimitStatus.ok) {
			return {
				ok: false,
				code: "BOOKING_RATE_LIMITED",
				retryAfter: globalRateLimitStatus.retryAfter,
			};
		}

		if (!rateLimitStatus.ok) {
			return {
				ok: false,
				code: "BOOKING_RATE_LIMITED",
				retryAfter: rateLimitStatus.retryAfter,
			};
		}

		const bookingId = await ctx.db.insert("bookings", {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			date: args.date,
			time: args.time,
			sessionStartAt: getSessionStartAt(args.date, args.time),
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			notes: args.notes,
			status: "pending_payment",
			pendingPaymentCreatedAt: Date.now(),
		});

		return { ok: true, bookingId };
	},
});

export const getBookings = query({
	args: {
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new Error("Not authenticated");
		}

		return await ctx.db
			.query("bookings")
			.withIndex("by_pendingPaymentCreatedAt")
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

type DeleteBookingErrorData = {
	code: "NOT_AUTHENTICATED" | "BOOKING_NOT_FOUND";
};

type UpdateBookingStatusErrorData = {
	code: "NOT_AUTHENTICATED" | "BOOKING_NOT_FOUND" | "INVALID_BOOKING_STATUS_TRANSITION";
};

type UpdateBookingPaidRemainingBalanceErrorData = {
	code: "NOT_AUTHENTICATED" | "BOOKING_NOT_FOUND";
};

type CleanupOldBookingsErrorData = {
	code: "NOT_AUTHENTICATED";
};

type SaveBookingInstagramHandleErrorData = {
	code: "BOOKING_NOT_FOUND" | "BOOKING_NOT_CONFIRMED";
};

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
	};
}

export const getBookingStatusByStripeSessionId = query({
	args: {
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();

		if (!booking) {
			return null;
		}

		return buildPublicBookingStatusResponse(booking);
	},
});

export const saveBookingInstagramHandle = mutation({
	args: {
		stripeSessionId: v.string(),
		instagramHandle: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();

		if (!booking) {
			throw new ConvexError<SaveBookingInstagramHandleErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		if (booking.status !== "confirmed") {
			throw new ConvexError<SaveBookingInstagramHandleErrorData>({
				code: "BOOKING_NOT_CONFIRMED",
			});
		}

		await ctx.db.patch(booking._id, {
			instagramHandle: args.instagramHandle,
		});

		return { ok: true as const };
	},
});

export const getBookingByIdInternal = internalQuery({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.bookingId);
	},
});

export const getBookingByStripeSessionIdInternal = internalQuery({
	args: {
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();
	},
});

export const listBookingsDueForReminderEmail = internalQuery({
	args: {
		dayStart: v.number(),
		dayEnd: v.number(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const bookings = await ctx.db
			.query("bookings")
			.withIndex("by_status_and_sessionStartAt", (query) =>
				query
					.eq("status", "confirmed")
					.gte("sessionStartAt", args.dayStart)
					.lt("sessionStartAt", args.dayEnd),
			)
			.take(args.limit ?? 50);

		return bookings.filter((booking) => !booking.reminderEmailSentAt);
	},
});

export const setBookingStripeSessionId = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.bookingId, {
			stripeSessionId: args.stripeSessionId,
		});
	},
});

export const markBookingExpiredByStripeSessionId = internalMutation({
	args: {
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
			.unique();

		if (!booking) {
			return { ok: false as const, reason: "not_found" as const };
		}

		if (booking.status === "expired") {
			return { ok: true as const, alreadyExpired: true as const };
		}

		if (booking.status !== "pending_payment") {
			return {
				ok: false as const,
				reason: "invalid_status" as const,
				status: booking.status,
			};
		}

		await ctx.db.patch(booking._id, {
			status: "expired",
		});

		return { ok: true as const, alreadyExpired: false as const };
	},
});

export const cleanupOldPendingAndExpiredBookings = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<CleanupOldBookingsErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		const pendingPaymentCutoff = Date.now() - STRIPE_CHECKOUT_SESSION_EXPIRY_MS;
		let deletedCount = 0;

		const pendingBookings = await ctx.db
			.query("bookings")
			.withIndex("by_status_and_pendingPaymentCreatedAt", (query) =>
				query.eq("status", "pending_payment").lt("pendingPaymentCreatedAt", pendingPaymentCutoff),
			)
			.take(50);

		const expiredOrAbandonedBookings = await Promise.all(
			(["expired", "abandoned"] as const).map((status) =>
				ctx.db
					.query("bookings")
					.withIndex("by_status_and_pendingPaymentCreatedAt", (query) => query.eq("status", status))
					.take(50),
			),
		);

		for (const booking of [...pendingBookings, ...expiredOrAbandonedBookings.flat()]) {
			await ctx.db.delete(booking._id);
			deletedCount += 1;
		}

		return { ok: true as const, deletedCount, pendingPaymentCutoff };
	},
});

export const claimBookingCompletion = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string()),
		stripeEventId: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			return {
				ok: false as const,
				reason: "not_found" as const,
			};
		}

		if (booking.stripeSessionId && booking.stripeSessionId !== args.stripeSessionId) {
			return {
				ok: false as const,
				reason: "stripe_session_mismatch" as const,
			};
		}

		if (booking.status === "confirmed") {
			return {
				ok: true as const,
				outcome: "already_confirmed" as const,
			};
		}

		if (booking.status === "expired") {
			return {
				ok: false as const,
				reason: "expired" as const,
			};
		}

		if (booking.status === "failed") {
			return {
				ok: false as const,
				reason: "failed" as const,
			};
		}

		if (booking.bookingConfirmationClaimedAt) {
			return {
				ok: true as const,
				outcome: "already_claimed" as const,
			};
		}

		if (booking.status !== "pending_payment") {
			return {
				ok: false as const,
				reason: "invalid_status" as const,
				status: booking.status,
			};
		}

		const now = Date.now();

		await ctx.db.patch(booking._id, {
			paymentCompletedAt: now,
			bookingConfirmationClaimedAt: now,
			bookingConfirmationEventId: args.stripeEventId,
			stripeSessionId: args.stripeSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
		});

		return {
			ok: true as const,
			outcome: "claimed" as const,
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
				notes: booking.notes,
			},
		};
	},
});

export const markBookingCompleted = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new Error("Booking not found");
		}

		await ctx.db.patch(args.bookingId, {
			status: "confirmed",
			googleEventId: args.googleEventId,
			googleCalendarId: args.googleCalendarId,
			bookingConfirmedAt: Date.now(),
			bookingFailureCode: undefined,
		});

		return null;
	},
});

export const markBookingCompletionFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new Error("Booking not found");
		}

		await ctx.db.patch(args.bookingId, {
			status: "failed",
			bookingFailureCode: args.failureCode,
		});

		return null;
	},
});

export const claimBookingReminderEmail = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking || booking.status !== "confirmed") {
			return { ok: false as const, reason: "not_sendable" as const };
		}

		if (booking.reminderEmailSentAt || booking.reminderEmailClaimedAt) {
			return { ok: false as const, reason: "already_claimed_or_sent" as const };
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: args.now,
			reminderEmailFailureCode: undefined,
		});

		return { ok: true as const, booking };
	},
});

export const markBookingReminderEmailSent = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new Error("Booking not found");
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: args.now,
			reminderEmailFailureCode: undefined,
		});

		return null;
	},
});

export const markBookingReminderEmailFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new Error("Booking not found");
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailFailureCode: args.failureCode,
		});

		return null;
	},
});

export const deletePendingBooking = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			return { ok: true as const, outcome: "not_found" as const };
		}

		if (booking.stripeSessionId !== args.stripeSessionId) {
			return {
				ok: false as const,
				reason: "stripe_session_mismatch" as const,
			};
		}

		if (booking.status !== "pending_payment") {
			return {
				ok: true as const,
				outcome: "not_pending" as const,
				status: booking.status,
			};
		}

		await ctx.db.patch(args.bookingId, {
			status: "abandoned",
		});

		return { ok: true as const, outcome: "abandoned" as const };
	},
});

export const deleteBooking = mutation({
	args: {
		bookingId: v.id("bookings"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<DeleteBookingErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<DeleteBookingErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		await ctx.db.delete(args.bookingId);

		return { ok: true as const };
	},
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
		service: v.string(),
		addons: v.array(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<DeleteBookingErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<DeleteBookingErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		const dateOrTimeChanged = booking.date !== args.date || booking.time !== args.time;

		await ctx.db.patch(args.bookingId, {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			date: args.date,
			time: args.time,
			sessionStartAt: getSessionStartAt(args.date, args.time),
			service: args.service,
			addons: args.addons,
			notes: args.notes,
			...(dateOrTimeChanged
				? {
						reminderEmailClaimedAt: undefined,
						reminderEmailSentAt: undefined,
						reminderEmailFailureCode: undefined,
					}
				: {}),
		});

		return { ok: true as const };
	},
});

export const updateBookingStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		status: v.union(v.literal("confirmed"), v.literal("failed")),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<UpdateBookingStatusErrorData>({ code: "NOT_AUTHENTICATED" });
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<UpdateBookingStatusErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		if (booking.status !== "confirmed" && booking.status !== "failed") {
			throw new ConvexError<UpdateBookingStatusErrorData>({
				code: "INVALID_BOOKING_STATUS_TRANSITION",
			});
		}

		await ctx.db.patch(args.bookingId, {
			status: args.status,
		});

		return { ok: true as const };
	},
});

export const updateBookingPaidRemainingBalance = mutation({
	args: {
		bookingId: v.id("bookings"),
		paidRemainingBalance: v.boolean(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<UpdateBookingPaidRemainingBalanceErrorData>({
				code: "NOT_AUTHENTICATED",
			});
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<UpdateBookingPaidRemainingBalanceErrorData>({
				code: "BOOKING_NOT_FOUND",
			});
		}

		await ctx.db.patch(args.bookingId, {
			paidRemainingBalance: args.paidRemainingBalance,
		});

		return { ok: true as const };
	},
});

export const updateBookingRemainingBalanceAmount = mutation({
	args: {
		bookingId: v.id("bookings"),
		remainingBalanceAmount: v.number(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError<UpdateBookingPaidRemainingBalanceErrorData>({
				code: "NOT_AUTHENTICATED",
			});
		}

		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			throw new ConvexError<UpdateBookingPaidRemainingBalanceErrorData>({
				code: "BOOKING_NOT_FOUND",
			});
		}

		await ctx.db.patch(args.bookingId, {
			remainingBalanceAmount: Math.max(args.remainingBalanceAmount, 0),
		});

		return { ok: true as const };
	},
});
