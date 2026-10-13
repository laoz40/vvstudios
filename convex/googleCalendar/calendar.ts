"use node";

import { v } from "convex/values";
import { ok, okAsync, safeTry } from "neverthrow";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import {
	type BusyDayWindow,
	type GetAvailableRescheduleTimesError,
	loadAvailableBookingTimesForDay,
	loadAvailableRescheduleTimesForDay,
	loadBookableRangeBusyWindows,
	loadRescheduleBookableRangeBusyWindows,
	loadRescheduleSessionAndBookingSettings
} from "#convex/googleCalendar/services/calendarAvailability";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/shared/services/rateLimits";
import { getBookingSettingsService } from "#convex/booking/services/settings";
import {
	attachAdminUpdateContext,
	requireEditSessionsPermissionAndLoadBooking,
	loadAdminSessionEditDeps,
	notifyHostIfNeeded,
	syncAdminBookingGoogleCalendarAndDb
} from "#convex/googleCalendar/services/adminUpdate";
import {
	requireCancelSessionsPermission,
	cleanupAdminCancelledBookingDrive,
	deleteAdminBookingCalendarEvent,
	loadAdminCancelSession,
	markBookingSessionCalendarDeleted
} from "#convex/googleCalendar/services/cancelBookingFromAdmin";
import {
	finishReschedule,
	loadRescheduleTargetAndValidate,
	lockAndReserve,
	saveClientRescheduleAndUnlockLink,
	syncCalendar
} from "#convex/googleCalendar/services/calendarReschedule";
import type { CancelBookingFromAdminError } from "#convex/googleCalendar/services/calendar";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/services/formValidators";
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
} from "#convex/booking/services/claimedSession";
import type { CompleteClaimedSessionSuccess } from "#convex/booking/services/confirmation";
import { clearCancelledSessionDriveFields } from "#convex/drive/services/cleanupCancelledSessionDrive";

export const setupDrive = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "edit:sessions");
			const setup = yield* loadValidatedDriveSetup(ctx, args);
			yield* ensureSessionDriveFolders(ctx, setup, true);
			yield* markDriveSetupSuccessful(ctx, args);
			yield* sendClientAssetsEmailAfterSetup(ctx, args.bookingId);
			yield* setupEditorAccessAfterSetup(ctx, args.bookingId);

			return ok(null);
		})
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
			.match(tupleOk, tupleErr)
});

export const retryDriveSetup = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, SetupError>> =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "edit:sessions");
			const setup = yield* loadValidatedDriveSetup(ctx, args);
			yield* ensureSessionDriveFolders(ctx, setup, true);
			yield* markDriveSetupSuccessful(ctx, args);
			yield* sendClientAssetsEmailAfterSetup(ctx, args.bookingId);
			yield* setupEditorAccessAfterSetup(ctx, args.bookingId);

			return ok(null);
		})
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
			.match(tupleOk, tupleErr)
});

export const retryClientDrivePermissions = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "edit:sessions");
			const setup = yield* loadReadyBookingDriveFolders(ctx, args.bookingId);
			yield* syncBookingDriveClientIdForRetry(ctx, args.bookingId);
			yield* requireClientDrivePermissions(ctx, setup).orElse((error) =>
				recordClientDrivePermissionsFailure(ctx, setup, error)
			);

			return ok(null);
		}).match(tupleOk, tupleErr)
});

export const retryClientAssetsEmail = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<null, DriveClientPermissionsError>> =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "edit:sessions");
			const result = yield* sendClientAssetsFolderEmail(ctx, args.bookingId, "retry");

			return ok(result);
		}).match(tupleOk, tupleErr)
});

export const runScheduledDriveSetup = internalAction({
	args: { bookingId: v.id("bookings"), sessionStartAt: v.number(), duration: v.string() },
	// Scheduled jobs resume partial setup; admins may recreate missing folders.
	handler: (ctx, args): Promise<Result<null, never>> =>
		safeTry(async function* () {
			const setup = yield* loadValidatedDriveSetup(ctx, args);
			yield* ensureSessionDriveFolders(ctx, setup, false);
			yield* markDriveSetupSuccessful(ctx, args);
			yield* sendClientAssetsEmailAfterSetup(ctx, args.bookingId);
			yield* setupEditorAccessAfterSetup(ctx, args.bookingId);

			return ok(null);
		})
			.orElse((error) => recordDriveSetupFailure(ctx, args.bookingId, error))
			.orElse(() => okAsync(null))
			.match(tupleOk, tupleErr)
});

export const getBookableRangeBusyWindows = action({
	args: { rateLimitKey: v.string() },
	handler: async (ctx, args) =>
		await safeTry(async function* () {
			yield* checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey);
			const settings = yield* getBookingSettingsService(ctx);
			const busyWindows = yield* loadBookableRangeBusyWindows(settings);

			return ok(busyWindows);
		}).match(tupleOk, tupleErr)
});

export const getAvailableBookingTimes = action({
	args: { date: v.string(), duration: v.string() },
	handler: async (ctx, args) =>
		await safeTry(async function* () {
			const settings = yield* getBookingSettingsService(ctx);
			const times = yield* loadAvailableBookingTimesForDay(args, settings);

			return ok(times);
		}).match(tupleOk, tupleErr)
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
		await safeTry(async function* () {
			yield* checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey);
			const { details, settings } = yield* loadRescheduleSessionAndBookingSettings(ctx, args.token);
			const busyWindows = yield* loadRescheduleBookableRangeBusyWindows(settings, details);

			return ok(busyWindows);
		}).match(tupleOk, tupleErr)
});

export const getAvailableRescheduleTimes = action({
	args: { token: v.string(), date: v.string() },
	handler: async (
		ctx,
		args
	): Promise<Result<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError>> =>
		await safeTry(async function* () {
			const { details, settings } = yield* loadRescheduleSessionAndBookingSettings(ctx, args.token);
			const times = yield* loadAvailableRescheduleTimesForDay(args, details, settings);

			return ok(times);
		}).match(tupleOk, tupleErr)
});

export const rescheduleSession = action({
	args: { token: v.string(), date: v.string(), time: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { calendarClient, details, sessionStartAt, settings } =
				yield* loadRescheduleTargetAndValidate(ctx, args);

			const state = yield* lockAndReserve(ctx, details, sessionStartAt, settings);
			const calendarState = yield* syncCalendar(ctx, args, state, calendarClient);

			const {
				session,
				settings: rescheduleSettings,
				timingUpdate
			} = yield* saveClientRescheduleAndUnlockLink(ctx, args, calendarState);

			const result = yield* finishReschedule(session, args, timingUpdate, rescheduleSettings);

			return ok(result);
		}).match(tupleOk, tupleErr)
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
		safeTry(async function* () {
			const session = yield* requireEditSessionsPermissionAndLoadBooking(ctx, args.bookingId);
			const { client, settings } = yield* loadAdminSessionEditDeps(ctx);

			const result = yield* syncAdminBookingGoogleCalendarAndDb({
				args,
				session,
				client,
				ctx,
				settings
			});

			const {
				result: updateResult,
				session: updatedSession,
				settings: updatedSettings
			} = attachAdminUpdateContext(session, settings, result);

			const notification = yield* notifyHostIfNeeded(
				ctx,
				args,
				updatedSession,
				updatedSettings,
				updateResult
			);

			return ok(notification);
		}).match(tupleOk, tupleErr)
});

export const cancelBookingFromAdmin = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args): Promise<Result<{ cancelled: boolean }, CancelBookingFromAdminError>> =>
		safeTry(async function* () {
			yield* requireCancelSessionsPermission(ctx);
			const session = yield* loadAdminCancelSession(ctx, args.bookingId);
			yield* deleteAdminBookingCalendarEvent(session);
			yield* markBookingSessionCalendarDeleted(ctx, args.bookingId);
			const result = yield* cleanupAdminCancelledBookingDrive(ctx, args.bookingId);

			return ok(result);
		}).match(tupleOk, tupleErr)
});

export const sendSessionReminderEmail = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const now = Date.now();

		return await safeTry(async function* () {
			const claim = yield* claimSessionReminderSend(ctx, args.bookingId, now);
			const result = yield* sendSessionReminderWhenClaimed(ctx, args.bookingId, claim);

			return ok(result);
		}).match(tupleOk, tupleErr);
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
