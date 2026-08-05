"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { type BusyDayWindow } from "./lib/sessionCalendarTime";
import { type AdminSessionUpdateArgs } from "./lib/sessionAdminEdit";
import {
	deleteSessionFromAdminService,
	getAvailableBookingTimesService,
	getAvailableRescheduleTimesService,
	getBookableRangeBusyWindowsService,
	getRescheduleBookableRangeBusyWindowsService,
	rescheduleSessionService,
	type GetAvailableRescheduleTimesError,
	updateSessionFromAdminService,
	type RescheduleSessionArgs
} from "./services/sessionCalendar";
import {
	completeClaimedSessionService,
	sendBookingInvoiceForBookingService,
	sendSessionReminderEmailService,
	type SendBookingInvoiceForBookingArgs
} from "./services/bookingConfirmationActions";

type DeleteBookingFromAdminArgs = { bookingId: Id<"bookings"> };
export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: (ctx, args) => getBookableRangeBusyWindowsHandler(ctx, args)
});

async function getBookableRangeBusyWindowsHandler(ctx: ActionCtx, args: { rateLimitKey: string }) {
	return await getBookableRangeBusyWindowsService(ctx, args).match(tupleOk, tupleErr);
}

export type GetBookableRangeBusyWindowsResult = Awaited<
	ReturnType<typeof getBookableRangeBusyWindowsHandler>
>;

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: (ctx, args) => getAvailableBookingTimesHandler(ctx, args)
});

async function getAvailableBookingTimesHandler(
	ctx: ActionCtx,
	args: { date: string; duration: string }
) {
	return await getAvailableBookingTimesService(ctx, args).match(tupleOk, tupleErr);
}

export type GetAvailableBookingTimesResult = Awaited<
	ReturnType<typeof getAvailableBookingTimesHandler>
>;

export const getRescheduleBookableRangeBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: (ctx, args) => getRescheduleBookableRangeBusyWindowsHandler(ctx, args)
});

async function getRescheduleBookableRangeBusyWindowsHandler(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): Promise<
	Result<
		{ busyWindowsByMonth: Record<string, BusyDayWindow[]>; timeZone: string },
		GetAvailableRescheduleTimesError
	>
> {
	return await getRescheduleBookableRangeBusyWindowsService(ctx, args).match(tupleOk, tupleErr);
}

export type GetRescheduleBookableRangeBusyWindowsResult = Awaited<
	ReturnType<typeof getRescheduleBookableRangeBusyWindowsHandler>
>;

export const getAvailableRescheduleTimes = action({
	args: { token: v.string(), date: v.string() },
	handler: (ctx, args) => getAvailableRescheduleTimesHandler(ctx, args)
});

async function getAvailableRescheduleTimesHandler(
	ctx: ActionCtx,
	args: { date: string; token: string }
): Promise<Result<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError>> {
	return await getAvailableRescheduleTimesService(ctx, args).match(tupleOk, tupleErr);
}

export type GetAvailableRescheduleTimesResult = Awaited<
	ReturnType<typeof getAvailableRescheduleTimesHandler>
>;

export const rescheduleSession = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: (ctx, args) => rescheduleSessionHandler(ctx, args)
});

async function rescheduleSessionHandler(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return await rescheduleSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type RescheduleSessionResult = Awaited<ReturnType<typeof rescheduleSessionHandler>>;

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
	handler: updateSessionFromAdminHandler
});

async function updateSessionFromAdminHandler(ctx: ActionCtx, args: AdminSessionUpdateArgs) {
	return await updateSessionFromAdminService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateSessionFromAdminResult = Awaited<
	ReturnType<typeof updateSessionFromAdminHandler>
>;

export const sendBookingInvoiceForBooking = action({
	args: { bookingId: v.id("bookings"), customInvoiceId: v.optional(v.id("customInvoices")) },
	handler: (ctx, args) => sendBookingInvoiceForBookingHandler(ctx, args)
});

async function sendBookingInvoiceForBookingHandler(
	ctx: ActionCtx,
	args: SendBookingInvoiceForBookingArgs
) {
	return (await sendBookingInvoiceForBookingService(ctx, args)).match(tupleOk, tupleErr);
}

export type SendBookingInvoiceForBookingResult = Awaited<
	ReturnType<typeof sendBookingInvoiceForBookingHandler>
>;

export const deleteSessionFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: deleteSessionFromAdminHandler
});

async function deleteSessionFromAdminHandler(ctx: ActionCtx, args: DeleteBookingFromAdminArgs) {
	return await deleteSessionFromAdminService(ctx, args.bookingId).match(tupleOk, tupleErr);
}

export type DeleteSessionFromAdminResult = Awaited<
	ReturnType<typeof deleteSessionFromAdminHandler>
>;

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await sendSessionReminderEmailService(ctx, args)).match(tupleOk, tupleErr)
});

export const completeClaimedSession = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => completeClaimedSessionHandler(ctx, args)
});

async function completeClaimedSessionHandler(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return (await completeClaimedSessionService(ctx, args)).match(tupleOk, tupleErr);
}

export type CompleteClaimedSessionResult = Awaited<
	ReturnType<typeof completeClaimedSessionHandler>
>;
