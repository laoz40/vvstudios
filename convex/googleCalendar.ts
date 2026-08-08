"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "./_generated/server";
import { type BusyDayWindow } from "./lib/sessionCalendarTime";
import {
	deleteSessionFromAdminService,
	getAvailableBookingTimesService,
	getAvailableRescheduleTimesService,
	getBookableRangeBusyWindowsService,
	getRescheduleBookableRangeBusyWindowsService,
	rescheduleSessionService,
	type GetAvailableRescheduleTimesError,
	updateSessionFromAdminService
} from "./services/sessionCalendar";
import {
	completeClaimedSessionService,
	sendBookingInvoiceForBookingService,
	sendSessionReminderEmailService
} from "./services/bookingConfirmationActions";

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: async (ctx, args) =>
		await getBookableRangeBusyWindowsService(ctx, args).match(tupleOk, tupleErr)
});

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: async (ctx, args) =>
		await getAvailableBookingTimesService(ctx, args).match(tupleOk, tupleErr)
});

export const getRescheduleBookableRangeBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: async (
		ctx,
		args
	): Promise<
		Result<
			{ busyWindowsByMonth: Record<string, BusyDayWindow[]>; timeZone: string },
			GetAvailableRescheduleTimesError
		>
	> => await getRescheduleBookableRangeBusyWindowsService(ctx, args).match(tupleOk, tupleErr)
});

export const getAvailableRescheduleTimes = action({
	args: { token: v.string(), date: v.string() },
	handler: async (
		ctx,
		args
	): Promise<Result<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError>> =>
		await getAvailableRescheduleTimesService(ctx, args).match(tupleOk, tupleErr)
});

export const rescheduleSession = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: async (ctx, args) => await rescheduleSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionFromAdmin = action({
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
		remainingBalanceAmount: v.optional(v.number())
	},
	handler: async (ctx, args) =>
		await updateSessionFromAdminService(ctx, args).match(tupleOk, tupleErr)
});

export const sendBookingInvoiceForBooking = action({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.optional(v.id("customInvoices")) },
	handler: async (ctx, args) =>
		(await sendBookingInvoiceForBookingService(ctx, args)).match(tupleOk, tupleErr)
});

export const deleteSessionFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		await deleteSessionFromAdminService(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await sendSessionReminderEmailService(ctx, args)).match(tupleOk, tupleErr)
});

export const completeClaimedSession = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await completeClaimedSessionService(ctx, args)).match(tupleOk, tupleErr)
});
