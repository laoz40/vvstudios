import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import type {
	CreatePackageSessionError,
	ReschedulePackageSessionError,
	UnschedulePackageSessionError
} from "#convex/packages/services/sessionSchedulingTypes";
import {
	action,
	internalMutation,
	mutation,
	internalQuery,
	query
} from "#convex/_generated/server";
import { SERVICES } from "#/domain/booking/catalog";
import {
	cancelPackageSessionBooking,
	loadPackageSessionOwnedByToken
} from "#convex/packages/services/sessionCancel";
import {
	rejectFullPackageAndParseSessionStartTime,
	rejectPackageCreateWhenUnavailableOrFull,
	parsePackageRescheduleStartTime,
	parsePackageSessionCreateStartTime,
	clearPackageExpiryReminderStateWhenPending,
	insertPackageSessionBookingRow,
	loadEditablePackageSessionForReschedule,
	loadValidPackageAndBookingSettings,
	loadEditablePackageSessionForUnschedule,
	loadValidPackageAndCapacityConsumingSessions,
	schedulePackageAdjustmentWhenAllSessionsBooked
} from "#convex/packages/services/sessionMutations";
import {
	loadPackageCreateRequestAndCheckRateLimit,
	cleanupCancelledPackageDrive,
	clearPackageSessionCalendar,
	loadPackageRescheduleTarget,
	loadPackageUnscheduleTarget,
	markPackageSessionCancelled,
	saveCreatedPackageSessionAfterCalendar,
	savePackageSessionRescheduleAfterCalendar,
	reservePackageRescheduleSlot,
	syncNewPackageSessionCalendar,
	syncPackageRescheduleCalendar
} from "#convex/packages/services/sessionScheduling";
import {
	deferCompletedPackageAdjustment,
	deferExpiredPackageAdjustment,
	loadCompletedPackageAdjustmentSessions,
	loadExpiredPackageAdjustmentSessions,
	recordPackageAdjustment
} from "#convex/packages/services/adjustmentCron";
import { archivePackageWhenFullyDone } from "#convex/packages/services/archive";
import {
	loadPackageSchedulingPageByToken,
	loadPaidPackageByScheduleToken,
	writePackageDefaultRecordingSpace
} from "#convex/packages/services/tokenScheduling";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) =>
		loadPackageSchedulingPageByToken(ctx, { token: args.token, now: Date.now() }).match(
			tupleOk,
			tupleErr
		)
});

const recordingSpaceValidator = v.union(...SERVICES.map((service) => v.literal(service)));

export const setDefaultSpace = mutation({
	args: { service: recordingSpaceValidator, token: v.string() },
	handler: (ctx, args) =>
		writePackageDefaultRecordingSpace(ctx, {
			service: args.service,
			token: args.token,
			now: Date.now()
		}).match(tupleOk, tupleErr)
});

const packageSessionInput = {
	token: v.string(),
	date: v.string(),
	time: v.string(),
	service: recordingSpaceValidator,
	notes: v.optional(v.string()),
	remotePodcast: v.boolean()
};

export const createPackageSession = action({
	args: packageSessionInput,
	handler: (
		ctx,
		args
	): Promise<Result<{ bookingId: Id<"bookings"> }, CreatePackageSessionError>> => {
		const now = Date.now();

		return safeTry(async function* () {
			const details = yield* loadPackageCreateRequestAndCheckRateLimit(ctx, args, now);

			const { calendar, details: calendarDetails } = yield* syncNewPackageSessionCalendar(
				ctx,
				args,
				details
			);

			const booking = yield* saveCreatedPackageSessionAfterCalendar(
				ctx,
				args,
				now,
				calendar,
				calendarDetails
			);

			return ok(booking);
		}).match(tupleOk, tupleErr);
	}
});

export const reschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), ...packageSessionInput },
	handler: (
		ctx,
		args
	): Promise<Result<{ bookingId: Id<"bookings"> }, ReschedulePackageSessionError>> => {
		const now = Date.now();

		return safeTry(async function* () {
			const details = yield* loadPackageRescheduleTarget(ctx, args, now);
			const reservation = yield* reservePackageRescheduleSlot(ctx, args, details);

			const {
				calendar,
				details: calendarDetails,
				reservation: calendarReservation
			} = yield* syncPackageRescheduleCalendar(ctx, args, details, reservation);

			const booking = yield* savePackageSessionRescheduleAfterCalendar(
				ctx,
				args,
				calendarDetails,
				calendar,
				calendarReservation
			);

			return ok(booking);
		}).match(tupleOk, tupleErr);
	}
});

export const unschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), token: v.string() },
	handler: (
		ctx,
		args
	): Promise<
		Result<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError>
	> => {
		const now = Date.now();

		return safeTry(async function* () {
			const details = yield* loadPackageUnscheduleTarget(ctx, args, now);
			yield* clearPackageSessionCalendar(ctx, details);
			const cancelled = yield* markPackageSessionCancelled(ctx, args, now);
			const result = yield* cleanupCancelledPackageDrive(ctx, cancelled);

			return ok(result);
		}).match(tupleOk, tupleErr);
	}
});

export const getValidPackageByToken = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: (ctx, args) => loadPaidPackageByScheduleToken(ctx, args).match(tupleOk, tupleErr)
});

export const processPackageAdjustmentAtExpiry = internalMutation({
	args: { packageId: v.id("packages"), expectedExpiresAt: v.number() },
	handler: (ctx, args) => {
		const now = Date.now();

		return safeTry(async function* () {
			const sessions = yield* loadExpiredPackageAdjustmentSessions(ctx, args, now);

			const nextCheckAt = yield* recordPackageAdjustment(
				ctx,
				{ packageId: args.packageId, trigger: "package_expired", createdAt: now },
				sessions
			);

			yield* deferExpiredPackageAdjustment(ctx, args, nextCheckAt);
			const archived = yield* archivePackageWhenFullyDone(ctx, args.packageId, now);

			return ok(archived);
		}).match(tupleOk, tupleErr);
	}
});

export const processPackageAdjustmentWhenSessionsComplete = internalMutation({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => {
		const now = Date.now();

		return safeTry(async function* () {
			const sessions = yield* loadCompletedPackageAdjustmentSessions(ctx, args.packageId);

			const nextCheckAt = yield* recordPackageAdjustment(
				ctx,
				{ packageId: args.packageId, trigger: "all_sessions_completed", createdAt: now },
				sessions
			);

			yield* deferCompletedPackageAdjustment(ctx, args.packageId, nextCheckAt);
			const archived = yield* archivePackageWhenFullyDone(ctx, args.packageId, now);

			return ok(archived);
		}).match(tupleOk, tupleErr);
	}
});

const requestArgs = { token: v.string(), date: v.string(), time: v.string(), now: v.number() };

export const validatePackageSessionRequest = internalQuery({
	args: requestArgs,
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { packageRecord, settings } = yield* loadValidPackageAndBookingSettings(ctx, args);

			const { packageRecord: validatedPackage, settings: validatedSettings } =
				yield* rejectPackageCreateWhenUnavailableOrFull(ctx, args, packageRecord, settings);

			const parsed = yield* parsePackageSessionCreateStartTime(
				args,
				validatedPackage,
				validatedSettings
			);

			return ok(parsed);
		}).match(tupleOk, tupleErr)
});

export const validatePackageRescheduleRequest = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const details = yield* loadEditablePackageSessionForReschedule(ctx, args);
			const parsed = yield* parsePackageRescheduleStartTime(args, details);

			return ok(parsed);
		}).match(tupleOk, tupleErr)
});

export const validatePackageUnscheduleRequest = internalQuery({
	args: { token: v.string(), bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) =>
		loadEditablePackageSessionForUnschedule(ctx, args).match(tupleOk, tupleErr)
});

export const saveCreatedPackageSession = internalMutation({
	args: {
		...packageSessionInput,
		now: v.number(),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string())
	},
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { packageFromDb, packageSessions } =
				yield* loadValidPackageAndCapacityConsumingSessions(ctx, args);

			const { packageFromDb: validatedPackage, sessionStartAt } =
				yield* rejectFullPackageAndParseSessionStartTime(args, packageFromDb, packageSessions);

			const { bookingId, packageFromDb: insertedPackage } = yield* insertPackageSessionBookingRow(
				ctx,
				args,
				validatedPackage,
				sessionStartAt
			);

			const { bookingId: clearedBookingId, packageFromDb: clearedPackage } =
				yield* clearPackageExpiryReminderStateWhenPending(ctx, insertedPackage, bookingId);

			const scheduled = yield* schedulePackageAdjustmentWhenAllSessionsBooked(
				ctx,
				clearedPackage._id,
				clearedBookingId
			);

			return ok(scheduled);
		}).match(tupleOk, tupleErr)
});

export const cancelPackageSession = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const packageFromDb = yield* loadPaidPackageByScheduleToken(ctx, args);
			yield* loadPackageSessionOwnedByToken(ctx, packageFromDb, args.bookingId);
			const cancelled = yield* cancelPackageSessionBooking(ctx, args.bookingId);

			return ok(cancelled);
		}).match(tupleOk, tupleErr)
});
