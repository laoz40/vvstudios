import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

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
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("bookings", {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			date: args.date,
			time: args.time,
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			notes: args.notes,
			status: "pending_payment",
			pendingPaymentCreatedAt: Date.now(),
		});
	},
});

export const getBookings = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new Error("Not authenticated");
		}

		return await ctx.db
			.query("bookings")
			.withIndex("by_pendingPaymentCreatedAt")
			.order("desc")
			.take(100);
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
			checkoutExpiredAt: Date.now(),
		});

		return { ok: true as const, alreadyExpired: false as const };
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
