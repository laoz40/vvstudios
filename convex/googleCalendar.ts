"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import {
	type BusyDayWindow,
	type GetAvailableRescheduleTimesError,
	enforceGoogleCalendarAvailabilityRateLimit,
	loadAvailableBookingTimesForDay,
	loadAvailableRescheduleTimesForDay,
	loadBookableRangeBusyWindows,
	loadRescheduleBookableRangeBusyWindows,
	loadRescheduleSessionAndBookingSettings,
	loadBookingAvailabilitySettingsForAction
} from "#convex/services/googleCalendar/sessionCalendarAvailability";
import {
	type RescheduleSessionError,
	type UpdateSessionFromAdminError
} from "#convex/services/googleCalendar/sessionCalendar";
import {
	requireEditSessionsPermissionAndLoadBooking,
	loadAdminSessionEditDeps,
	notifyHostIfNeeded,
	syncAdminBookingGoogleCalendarAndDb
} from "#convex/services/googleCalendar/sessionAdminUpdate";
import {
	requireCancelSessionsPermission,
	cleanupAdminCancelledBookingDrive,
	deleteAdminBookingCalendarEvent,
	loadAdminCancelSession,
	markBookingSessionCalendarDeleted
} from "#convex/services/googleCalendar/cancelBookingFromAdmin";
import {
	finishReschedule,
	loadRescheduleTargetAndValidate,
	lockAndReserve,
	saveClientRescheduleAndUnlockLink,
	syncCalendar
} from "#convex/services/googleCalendar/sessionCalendarReschedule";
import type { CancelBookingFromAdminError } from "#convex/services/googleCalendar/sessionCalendar";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/services/booking/bookingFormValidators";
import type { AdminSessionUpdateResult } from "#convex/services/googleCalendar/sessionAdminUpdate";
import {
	createSessionDriveFoldersAndCompleteSetup,
	runScheduledSessionDriveFolderSetup,
	type SetupError
} from "#convex/services/drive/drive";
import {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail,
	syncBookingDriveClientIdForRetry,
	type DriveClientPermissionsError
} from "#convex/services/drive/driveClientPermissions";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import {
	claimSessionReminderSend,
	sendSessionReminderWhenClaimed
} from "#convex/services/booking/sessionReminderEmail";
import {
	runCompleteClaimedSession,
	type CompleteClaimedSessionError
} from "#convex/services/booking/bookingClaimedSession";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";
import type { Id } from "#convex/_generated/dataModel";
import { clearCancelledSessionDriveFields } from "#convex/services/drive/cleanupCancelledSessionDrive";

export const setupDrive = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() =>
				createSessionDriveFoldersAndCompleteSetup(ctx, {
					bookingId: args.bookingId,
					replaceMissingFolders: true
				})
			)
			.match(tupleOk, tupleErr)
});

export const retryDriveSetup = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() =>
				createSessionDriveFoldersAndCompleteSetup(ctx, {
					bookingId: args.bookingId,
					replaceMissingFolders: true
				})
			)
			.match(tupleOk, tupleErr)
});

export const retryClientDrivePermissions = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => loadReadyBookingDriveFolders(ctx, args.bookingId))
			.andThen((setup) =>
				syncBookingDriveClientIdForRetry(ctx, args.bookingId).andThen(() =>
					requireClientDrivePermissions(ctx, setup).orElse((error) =>
						recordClientDrivePermissionsFailure(ctx, setup, error)
					)
				)
			)
			.map(() => null)
			.match(tupleOk, tupleErr)
});

export const retryClientAssetsEmail = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => sendClientAssetsFolderEmail(ctx, args.bookingId, "retry"))
			.match(tupleOk, tupleErr)
});

export const runScheduledDriveSetup = internalAction({
	args: { bookingId: v.id("bookings"), sessionStartAt: v.number(), duration: v.string() },
	handler: async (ctx, args) =>
		(await runScheduledSessionDriveFolderSetup(ctx, args)).match(tupleOk, tupleErr)
});

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: async (ctx, args) =>
		await enforceGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
			.andThen(() => loadBookingAvailabilitySettingsForAction(ctx))
			.andThen((settings) => loadBookableRangeBusyWindows(settings))
			.match(tupleOk, tupleErr)
});

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: async (ctx, args) =>
		await loadBookingAvailabilitySettingsForAction(ctx)
			.andThen((settings) => loadAvailableBookingTimesForDay(args, settings))
			.match(tupleOk, tupleErr)
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
	> =>
		await enforceGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
			.andThen(() => loadRescheduleSessionAndBookingSettings(ctx, args.token))
			.andThen(({ details, settings }) => loadRescheduleBookableRangeBusyWindows(settings, details))
			.match(tupleOk, tupleErr)
});

export const getAvailableRescheduleTimes = action({
	args: { token: v.string(), date: v.string() },
	handler: async (
		ctx,
		args
	): Promise<Result<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError>> =>
		await loadRescheduleSessionAndBookingSettings(ctx, args.token)
			.andThen(({ details, settings }) =>
				loadAvailableRescheduleTimesForDay(args, details, settings)
			)
			.match(tupleOk, tupleErr)
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
			.andThen((state) => saveClientRescheduleAndUnlockLink(ctx, args, state))
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
		requireEditSessionsPermissionAndLoadBooking(ctx, args.bookingId)
			.andThen((session) => loadAdminSessionEditDeps(ctx).map((deps) => ({ session, ...deps })))
			.andThen(({ client, session, settings }) =>
				syncAdminBookingGoogleCalendarAndDb({ args, session, client, ctx, settings }).map(
					(result) => ({ result, session, settings })
				)
			)
			.andThen(({ result, session, settings }) =>
				notifyHostIfNeeded(ctx, args, session, settings, result)
			)
			.match(tupleOk, tupleErr)
});

export const cancelBookingFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<{ cancelled: boolean }, CancelBookingFromAdminError>> =>
		requireCancelSessionsPermission(ctx)
			.andThen(() => loadAdminCancelSession(ctx, args.bookingId))
			.andThen(deleteAdminBookingCalendarEvent)
			.andThen(() => markBookingSessionCalendarDeleted(ctx, args.bookingId))
			.andThen(() => cleanupAdminCancelledBookingDrive(ctx, args.bookingId))
			.match(tupleOk, tupleErr)
});

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const now = Date.now();

		return await claimSessionReminderSend(ctx, args.bookingId, now)
			.andThen((claim) => sendSessionReminderWhenClaimed(ctx, args.bookingId, claim))
			.match(tupleOk, tupleErr);
	}
});

export const completeClaimedSession = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: (
		ctx,
		args
	): Promise<Result<CompleteClaimedSessionSuccess, CompleteClaimedSessionError>> =>
		runCompleteClaimedSession(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const cleanupCancelledSessionDrive = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		await clearCancelledSessionDriveFields(ctx, args).match(tupleOk, tupleErr)
});
