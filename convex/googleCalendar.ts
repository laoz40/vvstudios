"use node";

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
	type RescheduleSessionError
} from "#convex/services/googleCalendar/sessionCalendar";
import { loadBookingAvailabilitySettings } from "#convex/lib/booking/bookingConfirmationActionBoundaries";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { requirePermissionActions } from "#convex/services/auth";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import type {
	AdminSessionUpdateError,
	AdminSessionUpdateResult
} from "#convex/lib/sessions/sessionAdminEdit";
import {
	finishRescheduledSession,
	lockAndReserveReschedule,
	loadRescheduleDetails,
	saveRescheduledSession,
	unlockRescheduleAfterSave,
	updateRescheduleCalendar,
	validateRescheduleTarget
} from "#convex/services/googleCalendar/sessionRescheduleWorkflow";
import {
	maybeNotifyHostAfterAdminReschedule,
	updateAdminSession
} from "#convex/services/googleCalendar/sessionAdminUpdateWorkflow";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
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
	alreadyCompletedClaimedSessionOutcome,
	finishIncompleteClaimedSession,
	requireBookingConfirmationClaimed,
	type CompleteClaimedSessionError
} from "#convex/services/booking/bookingClaimedSessionWorkflow";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";
import { okAsync } from "neverthrow";
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
	handler: async (
		ctx,
		args
	): Promise<
		Result<
			{ bookingId: Id<"bookings">; warning?: "RESCHEDULE_EMAIL_SEND_FAILED" },
			RescheduleSessionError
		>
	> =>
		(
			await loadRescheduleDetails(ctx, args)
				.andThen((details) => validateRescheduleTarget(ctx, args, details))
				.andThen(({ calendarClient, details, sessionStartAt, settings }) =>
					lockAndReserveReschedule(ctx, details, sessionStartAt, settings).map((state) => ({
						calendarClient,
						state
					}))
				)
				.andThen(({ calendarClient, state }) =>
					updateRescheduleCalendar(ctx, args, state, calendarClient)
				)
				.andThen((state) => saveRescheduledSession(ctx, args, state))
				.andThen((state) => unlockRescheduleAfterSave(ctx, state))
				.andThen(({ session, settings, timingUpdate }) =>
					finishRescheduledSession(session, args, timingUpdate, settings)
				)
		).match(tupleOk, tupleErr)
});

type UpdateSessionFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

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
	handler: async (
		ctx,
		args
	): Promise<Result<AdminSessionUpdateResult, UpdateSessionFromAdminError>> =>
		(
			await requirePermissionActions(ctx, "edit:sessions")
				.andThen(() => getSessionFromQuery(ctx, args.bookingId))
				.andThen((session) =>
					loadBookingAvailabilitySettings(ctx).map((settings) => ({ session, settings }))
				)
				.andThen(({ session, settings }) =>
					loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((client) => ({
						client,
						session,
						settings
					}))
				)
				.andThen(({ client, session, settings }) =>
					updateAdminSession({ args, session, client, ctx, settings }).andThen((result) =>
						maybeNotifyHostAfterAdminReschedule(ctx, args, session, settings, result)
					)
				)
		).match(tupleOk, tupleErr)
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
	handler: async (
		ctx,
		args
	): Promise<Result<CompleteClaimedSessionSuccess, CompleteClaimedSessionError>> =>
		(
			await getSessionFromQuery(ctx, args.bookingId)
				.andThen(requireBookingConfirmationClaimed)
				.andThen((session) => {
					const completed = alreadyCompletedClaimedSessionOutcome(session);

					return completed ? okAsync(completed) : finishIncompleteClaimedSession(ctx, session);
				})
		).match(tupleOk, tupleErr)
});

export const cleanupCancelledSessionDrive = internalAction({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		cleanupCancelledSessionDriveService(ctx, args).match(tupleOk, tupleErr)
});
