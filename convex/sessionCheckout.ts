import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { env } from "./env";
import { getSessionStartAt } from "./lib/sessionAdminEdit";
import {
	checkSessionMeetsAvailabilitySettings,
	type SessionAvailabilityValidationError
} from "./lib/sessionCalendarTime";
import { checkBookingSubmitRateLimit } from "./lib/rateLimits";

type CreatePendingSessionResult = Result<
	{ bookingId: Doc<"bookings">["_id"] },
	SessionAvailabilityValidationError
>;

export const checkSessionSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) => checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey)
});

export const createPendingSession = internalMutation({
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
	handler: async (ctx, args): Promise<CreatePendingSessionResult> => {
		const settings = await ctx.runQuery(api.bookingSettings.get, {});
		const [availabilityError] = checkSessionMeetsAvailabilitySettings({
			date: args.date,
			duration: args.duration,
			settings,
			time: args.time,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE
		});

		if (availabilityError !== null) {
			return err({ reason: availabilityError.reason });
		}

		const [sessionStartError, sessionStartAt] = getSessionStartAt(
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

export const getSessionByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();
	}
});

export const setSessionStripeSessionId = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.bookingId, { stripeSessionId: args.stripeSessionId });
	}
});

export const markSessionExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
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

export const deletePendingSession = internalMutation({
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
