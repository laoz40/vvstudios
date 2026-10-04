"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import { type BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";
import {
	cancelBookingFromAdminService,
	getAvailableBookingTimesService,
	getAvailableRescheduleTimesService,
	getBookableRangeBusyWindowsService,
	getRescheduleBookableRangeBusyWindowsService,
	rescheduleSessionService,
	type GetAvailableRescheduleTimesError,
	updateSessionFromAdminService
} from "#convex/services/googleCalendar/sessionCalendar";
import {
	retryDriveSetupService,
	runScheduledDriveSetupService,
	setupDriveService,
	type SetupError
} from "#convex/services/drive/drive";
import {
	retryClientAssetsEmailService,
	retryClientDrivePermissionsService,
	type DriveClientPermissionsError
} from "#convex/services/drive/driveClientPermissions";
import {
	completeClaimedSessionService,
	sendSessionReminderEmailService
} from "#convex/services/booking/bookingConfirmationActions";
import { cleanupCancelledSessionDriveService } from "#convex/services/drive/cleanupCancelledSessionDrive";

export const setupDrive = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		setupDriveService(ctx, args).match(tupleOk, tupleErr)
});

export const retryDriveSetup = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		retryDriveSetupService(ctx, args).match(tupleOk, tupleErr)
});

export const retryClientDrivePermissions = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		retryClientDrivePermissionsService(ctx, args).match(tupleOk, tupleErr)
});

export const retryClientAssetsEmail = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		retryClientAssetsEmailService(ctx, args).match(tupleOk, tupleErr)
});

export const runScheduledDriveSetup = internalAction({
	args: { bookingId: v.id("bookings"), sessionStartAt: v.number(), duration: v.string() },
	handler: async (ctx, args) =>
		(await runScheduledDriveSetupService(ctx, args)).match(tupleOk, tupleErr)
});

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
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string())
	},
	handler: async (ctx, args) =>
		await updateSessionFromAdminService(ctx, args).match(tupleOk, tupleErr)
});

export const cancelBookingFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		await cancelBookingFromAdminService(ctx, args.bookingId).match(tupleOk, tupleErr)
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

export const cleanupCancelledSessionDrive = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		cleanupCancelledSessionDriveService(ctx, args).match(tupleOk, tupleErr)
});
