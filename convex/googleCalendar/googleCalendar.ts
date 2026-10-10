"use node";

import { v } from "convex/values";
import { okAsync } from "neverthrow";
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
	loadRescheduleSessionAndBookingSettings
} from "#convex/googleCalendar/services/sessionCalendarAvailability";
import { getBookingSettingsService } from "#convex/booking/services/bookingSettings";
import {
	attachAdminUpdateContext,
	requireEditSessionsPermissionAndLoadBooking,
	loadAdminSessionEditDeps,
	notifyHostIfNeeded,
	syncAdminBookingGoogleCalendarAndDb
} from "#convex/googleCalendar/services/sessionAdminUpdate";
import {
	requireCancelSessionsPermission,
	cleanupAdminCancelledBookingDrive,
	deleteAdminBookingCalendarEvent,
	loadAdminCancelSession,
	markBookingSessionCalendarDeleted
} from "#convex/googleCalendar/services/cancelBookingFromAdmin";
import {
	attachCalendarClientToLockState,
	finishReschedule,
	loadRescheduleTargetAndValidate,
	lockAndReserve,
	saveClientRescheduleAndUnlockLink,
	syncCalendar
} from "#convex/googleCalendar/services/sessionCalendarReschedule";
import type { CancelBookingFromAdminError } from "#convex/googleCalendar/services/sessionCalendar";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/services/bookingFormValidators";
import {
	loadValidatedDriveSetup,
	markDriveSetupSuccessful,
	recordDriveSetupFailure,
	sendClientAssetsEmailAfterSetup,
	setupEditorAccessAfterSetup,
	type SetupError
} from "#convex/drive/services/drive";
import {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail,
	type DriveClientPermissionsError
} from "#convex/drive/services/clientDrivePermissions";
import { syncBookingDriveClientIdForRetry } from "#convex/drive/services/driveClientPermissions";
import { ensureSessionDriveFolders } from "#convex/drive/services/ensureSessionDriveFolders";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	claimSessionReminderSend,
	sendSessionReminderWhenClaimed
} from "#convex/booking/services/sessionReminderEmail";
import {
	runCompleteClaimedSession,
	type CompleteClaimedSessionError
} from "#convex/booking/services/bookingClaimedSession";
import type { CompleteClaimedSessionSuccess } from "#convex/booking/services/bookingConfirmation";
import { clearCancelledSessionDriveFields } from "#convex/drive/services/cleanupCancelledSessionDrive";

export const setupDrive = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => loadValidatedDriveSetup(ctx, args))
			.andThen((setup) => ensureSessionDriveFolders(ctx, setup, true))
			.andThen(() => markDriveSetupSuccessful(ctx, args))
			.andThen(() => sendClientAssetsEmailAfterSetup(ctx, args.bookingId))
			.andThen(() => setupEditorAccessAfterSetup(ctx, args.bookingId))
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
			.match(tupleOk, tupleErr)
});

export const retryDriveSetup = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		requirePermissionActions(ctx, "edit:sessions")
			.andThen(() => loadValidatedDriveSetup(ctx, args))
			.andThen((setup) => ensureSessionDriveFolders(ctx, setup, true))
			.andThen(() => markDriveSetupSuccessful(ctx, args))
			.andThen(() => sendClientAssetsEmailAfterSetup(ctx, args.bookingId))
			.andThen(() => setupEditorAccessAfterSetup(ctx, args.bookingId))
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
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
	// Scheduled jobs resume partial setup; admins may recreate missing folders.
	handler: (ctx, args): Promise<Result<null, never>> =>
		loadValidatedDriveSetup(ctx, args)
			.andThen((setup) => ensureSessionDriveFolders(ctx, setup, false))
			.andThen(() => markDriveSetupSuccessful(ctx, args))
			.andThen(() => sendClientAssetsEmailAfterSetup(ctx, args.bookingId))
			.andThen(() => setupEditorAccessAfterSetup(ctx, args.bookingId))
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
			.orElse(() => okAsync(null))
			.match(tupleOk, tupleErr)
});

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: async (ctx, args) =>
		await enforceGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
			.andThen(() => getBookingSettingsService(ctx))
			.andThen((settings) => loadBookableRangeBusyWindows(settings))
			.match(tupleOk, tupleErr)
});

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: async (ctx, args) =>
		await getBookingSettingsService(ctx)
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
	handler: (ctx, args) =>
		loadRescheduleTargetAndValidate(ctx, args)
			.andThen(({ calendarClient, details, sessionStartAt, settings }) =>
				lockAndReserve(ctx, details, sessionStartAt, settings).map((state) =>
					attachCalendarClientToLockState(calendarClient, state)
				)
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
	handler: (ctx, args) =>
		requireEditSessionsPermissionAndLoadBooking(ctx, args.bookingId)
			.andThen((session) => loadAdminSessionEditDeps(ctx).map((deps) => ({ session, ...deps })))
			.andThen(({ client, session, settings }) =>
				syncAdminBookingGoogleCalendarAndDb({ args, session, client, ctx, settings }).map(
					(result) => attachAdminUpdateContext(session, settings, result)
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
