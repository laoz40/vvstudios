"use node";

import { okAsync } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import { type BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";
import {
	cancelBookingFromAdminService,
	getAvailableBookingTimesService,
	getAvailableRescheduleTimesService,
	getBookableRangeBusyWindowsService,
	getRescheduleBookableRangeBusyWindowsService,
	type GetAvailableRescheduleTimesError,
	type RescheduleSessionError,
	type UpdateSessionFromAdminError
} from "#convex/services/googleCalendar/sessionCalendar";
import {
	authorizeAdminSessionEdit,
	loadAdminSessionEditDeps,
	notifyHostIfNeeded,
	persistAdminSessionGoogleUpdate
} from "#convex/services/googleCalendar/sessionAdminUpdateWorkflow";
import {
	finishReschedule,
	loadRescheduleTargetAndValidate,
	lockAndReserve,
	persistRescheduleAfterCalendar,
	syncCalendar
} from "#convex/services/googleCalendar/sessionRescheduleWorkflow";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import type { AdminSessionUpdateResult } from "#convex/lib/sessions/sessionAdminEdit";
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
import { sendSessionReminderEmailService } from "#convex/services/booking/bookingConfirmationActions";
import {
	loadClaimedSession,
	runCompletion,
	type CompleteClaimedSessionError
} from "#convex/services/booking/bookingClaimedSessionWorkflow";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";
import type { Id } from "#convex/_generated/dataModel";
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
	handler: (
		ctx,
		args
	): Promise<
		Result<
			{ bookingId: Id<"bookings">; warning?: "RESCHEDULE_EMAIL_SEND_FAILED" },
			RescheduleSessionError
		>
	> =>
		loadRescheduleTargetAndValidate(ctx, args)
			.andThen(({ calendarClient, details, sessionStartAt, settings }) =>
				lockAndReserve(ctx, details, sessionStartAt, settings).map((state) => ({
					calendarClient,
					state
				}))
			)
			.andThen(({ calendarClient, state }) => syncCalendar(ctx, args, state, calendarClient))
			.andThen((state) => persistRescheduleAfterCalendar(ctx, args, state))
			.andThen(({ session, settings, timingUpdate }) =>
				finishReschedule(session, args, timingUpdate, settings)
			)
			.match(tupleOk, tupleErr)
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
	handler: (ctx, args): Promise<Result<AdminSessionUpdateResult, UpdateSessionFromAdminError>> =>
		authorizeAdminSessionEdit(ctx, args.bookingId)
			.andThen((session) => loadAdminSessionEditDeps(ctx).map((deps) => ({ session, ...deps })))
			.andThen(({ client, session, settings }) =>
				persistAdminSessionGoogleUpdate({ args, session, client, ctx, settings }).map((result) => ({
					result,
					session,
					settings
				}))
			)
			.andThen(({ result, session, settings }) =>
				notifyHostIfNeeded(ctx, args, session, settings, result)
			)
			.match(tupleOk, tupleErr)
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
	handler: (
		ctx,
		args
	): Promise<Result<CompleteClaimedSessionSuccess, CompleteClaimedSessionError>> =>
		loadClaimedSession(ctx, args.bookingId)
			.andThen((loaded) =>
				loaded.kind === "done" ? okAsync(loaded.outcome) : runCompletion(ctx, loaded.session)
			)
			.match(tupleOk, tupleErr)
});

export const cleanupCancelledSessionDrive = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		cleanupCancelledSessionDriveService(ctx, args).match(tupleOk, tupleErr)
});
