import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	type MutationCtx,
	query
} from "./_generated/server";
import { env } from "./env";
import { isAdminIdentity, requireAdmin, requireBookingInDb } from "./lib/auth";
import { buildAdminBookingUpdatePatch, getBookingSessionStartAt } from "./lib/bookingAdminEdit";
import { checkBookingMeetsAvailabilitySettings } from "./lib/bookingCalendarTime";
import { rateLimiter } from "./lib/rateLimits";

type CreatePendingBookingResult =
	| { ok: true; bookingId: Doc<"bookings">["_id"] }
	| {
			ok: false;
			code:
				| "BOOKING_INVALID_DATE"
				| "BOOKING_INVALID_DURATION"
				| "BOOKING_INVALID_TIME"
				| "BOOKING_OUTSIDE_OPENING_HOURS"
				| "BOOKING_RATE_LIMITED"
				| "BOOKING_TOO_FAR_AHEAD"
				| "BOOKING_TOO_SOON";
			retryAfter?: number;
	  };

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
			return { ok: false, code: availabilityError.reason };
		}

		const globalRateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmitGlobal");
		const rateLimitStatus = await rateLimiter.limit(ctx, "bookingSubmit", {
			key: args.submitRateLimitKey
		});

		if (!globalRateLimitStatus.ok) {
			return {
				ok: false,
				code: "BOOKING_RATE_LIMITED",
				retryAfter: globalRateLimitStatus.retryAfter
			};
		}

		if (!rateLimitStatus.ok) {
			return { ok: false, code: "BOOKING_RATE_LIMITED", retryAfter: rateLimitStatus.retryAfter };
		}

		const [sessionStartError, sessionStartAt] = getBookingSessionStartAt(
			args.date,
			args.time,
			env.GOOGLE_CALENDAR_TIMEZONE
		);

		if (sessionStartError !== null) {
			return { ok: false, code: sessionStartError.reason };
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

		return { ok: true, bookingId };
	}
});

export const getBookings = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		await requireAdmin(ctx);

		return await ctx.db
			.query("bookings")
			.withIndex("by_pendingPaymentCreatedAt")
			.order("desc")
			.paginate(args.paginationOpts);
	}
});

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
			return { ok: false as const, reason: "not_found" as const };
		}

		if (booking.status === "expired") {
			return { ok: true as const, alreadyExpired: true as const };
		}

		if (booking.status !== "pending_payment") {
			return { ok: false as const, reason: "invalid_status" as const, status: booking.status };
		}

		await ctx.db.patch(booking._id, { status: "expired" });

		return { ok: true as const, alreadyExpired: false as const };
	}
});

export const cleanupOldPendingAndExpiredBookings = mutation({
	args: {},
	handler: cleanupOldPendingAndExpiredBookingsHandler
});

async function cleanupOldPendingAndExpiredBookingsHandler(ctx: MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
			return { ok: false as const, reason: "not_found" as const };
		}

		if (booking.stripeSessionId && booking.stripeSessionId !== args.stripeSessionId) {
			return { ok: false as const, reason: "stripe_session_mismatch" as const };
		}

		switch (booking.status) {
			case "confirmed":
			case "email_failed":
				return { ok: true as const, outcome: "already_confirmed" as const };

			case "expired":
				return { ok: false as const, reason: "expired" as const };

			case "failed":
				return { ok: false as const, reason: "failed" as const };

			case "abandoned":
				return { ok: false as const, reason: "invalid_status" as const, status: booking.status };

			case "pending_payment":
				break;

			default: {
				const _exhaustive: never = booking.status;
				return _exhaustive;
			}
		}

		if (booking.bookingConfirmationClaimedAt) {
			return { ok: true as const, outcome: "already_claimed" as const };
		}

		const now = Date.now();

		await ctx.db.patch(booking._id, {
			paymentCompletedAt: now,
			bookingConfirmationClaimedAt: now,
			bookingConfirmationEventId: args.stripeEventId,
			stripeSessionId: args.stripeSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId
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
				notes: booking.notes
			}
		};
	}
});

export const markBookingCompleted = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.patch(args.bookingId, {
			status: "confirmed",
			googleEventId: args.googleEventId,
			googleCalendarId: args.googleCalendarId,
			bookingConfirmedAt: Date.now(),
			bookingFailureCode: undefined
		});

		return null;
	}
});

export const markBookingInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.patch(args.bookingId, {
			status: "email_failed",
			bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
		});

		return null;
	}
});

export const markBookingInvoiceEmailSent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const booking = await requireBookingInDb(ctx, args.bookingId);

		if (booking.status !== "email_failed") {
			return null;
		}

		await ctx.db.patch(args.bookingId, { status: "confirmed", bookingFailureCode: undefined });

		return null;
	}
});

export const markBookingCompletionFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.patch(args.bookingId, { status: "failed", bookingFailureCode: args.failureCode });

		return null;
	}
});

export const claimBookingReminderEmail = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking || (booking.status !== "confirmed" && booking.status !== "email_failed")) {
			return { ok: false as const, reason: "not_sendable" as const };
		}

		if (booking.reminderEmailSentAt || booking.reminderEmailClaimedAt) {
			return { ok: false as const, reason: "already_claimed_or_sent" as const };
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return { ok: true as const, booking };
	}
});

export const markBookingReminderEmailSent = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return null;
	}
});

export const markBookingReminderEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailFailureCode: args.failureCode
		});

		return null;
	}
});

export const deletePendingBooking = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.db.get(args.bookingId);

		if (!booking) {
			return { ok: true as const, outcome: "not_found" as const };
		}

		if (booking.stripeSessionId !== args.stripeSessionId) {
			return { ok: false as const, reason: "stripe_session_mismatch" as const };
		}

		if (booking.status !== "pending_payment") {
			return { ok: true as const, outcome: "not_pending" as const, status: booking.status };
		}

		await ctx.db.patch(args.bookingId, { status: "abandoned" });

		return { ok: true as const, outcome: "abandoned" as const };
	}
});

export const deleteBookingInternal = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		await requireBookingInDb(ctx, args.bookingId);

		await ctx.db.delete(args.bookingId);

		return { ok: true as const };
	}
});

export const deleteBooking = mutation({
	args: { bookingId: v.id("bookings") },
	handler: deleteBookingHandler
});

type DeleteBookingArgs = { bookingId: Id<"bookings"> };

async function deleteBookingHandler(ctx: MutationCtx, args: DeleteBookingArgs) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	const booking = await ctx.db.get(args.bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
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
		const booking = await requireBookingInDb(ctx, args.bookingId);
		const [updatePatchError, updatePatch] = buildAdminBookingUpdatePatch({
			booking,
			timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
			values: args
		});

		if (updatePatchError !== null) {
			return { ok: false as const, reason: updatePatchError.reason };
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

		return { ok: true as const };
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
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
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
