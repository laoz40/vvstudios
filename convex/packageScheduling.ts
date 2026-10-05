import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import type {
	CreatePackageSessionError,
	ReschedulePackageSessionError,
	UnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";
import {
	action,
	internalMutation,
	mutation,
	internalQuery,
	query
} from "#convex/_generated/server";
import { SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import { getValidPackageByToken as findValidPackageByToken } from "#convex/lib/packages/packageLookup";
import { processPackageAdjustment } from "#convex/lib/packages/packageAdjustments";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";
import { okOrThrow } from "#convex/lib/result";
import { buildPackageTokenCustomerView } from "#convex/lib/packages/packageTokenView";
import {
	cancelPackageSessionBooking,
	loadPackageSessionOwnedByToken
} from "#convex/services/packages/packageSessionCancelWorkflow";
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
} from "#convex/services/packages/packageSessionMutationWorkflow";
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
} from "#convex/services/packages/packageSessionWorkflow";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) =>
		findValidPackageByToken(ctx, args.token, Date.now())
			.andThen((packageRecord) =>
				getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
					(sessions) => buildPackageTokenCustomerView(packageRecord, sessions)
				)
			)
			.match(tupleOk, tupleErr)
});

const recordingSpaceValidator = v.union(...SERVICES.map((service) => v.literal(service)));

export const setDefaultSpace = mutation({
	args: { service: recordingSpaceValidator, token: v.string() },
	handler: (ctx, args) =>
		findValidPackageByToken(ctx, args.token, Date.now())
			.andThen((packageRecord) =>
				okOrThrow(
					ctx.db
						.patch("packages", packageRecord._id, { defaultSpace: args.service })
						.then(() => ({ defaultSpace: args.service }))
				)
			)
			.match(tupleOk, tupleErr)
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

		return loadPackageCreateRequestAndCheckRateLimit(ctx, args, now)
			.andThen((details) => syncNewPackageSessionCalendar(ctx, args, details))
			.andThen(({ calendar, details }) =>
				saveCreatedPackageSessionAfterCalendar(ctx, args, now, calendar, details)
			)
			.match(tupleOk, tupleErr);
	}
});

export const reschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), ...packageSessionInput },
	handler: (
		ctx,
		args
	): Promise<Result<{ bookingId: Id<"bookings"> }, ReschedulePackageSessionError>> => {
		const now = Date.now();

		return loadPackageRescheduleTarget(ctx, args, now)
			.andThen((details) =>
				reservePackageRescheduleSlot(ctx, args, details).map((reservation) => ({
					details,
					reservation
				}))
			)
			.andThen(({ details, reservation }) =>
				syncPackageRescheduleCalendar(ctx, args, details, reservation)
			)
			.andThen(({ calendar, details, reservation }) =>
				savePackageSessionRescheduleAfterCalendar(ctx, args, details, calendar, reservation)
			)
			.match(tupleOk, tupleErr);
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

		return loadPackageUnscheduleTarget(ctx, args, now)
			.andThen((details) => clearPackageSessionCalendar(ctx, details).map(() => details))
			.andThen(() => markPackageSessionCancelled(ctx, args, now))
			.andThen((cancelled) => cleanupCancelledPackageDrive(ctx, cancelled))
			.match(tupleOk, tupleErr);
	}
});

export const getValidPackageByToken = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: (ctx, args) =>
		findValidPackageByToken(ctx, args.token, args.now).match(tupleOk, tupleErr)
});

export const processPackageAdjustmentAtExpiry = internalMutation({
	args: { packageId: v.id("packages"), expectedExpiresAt: v.number() },
	handler: async (ctx, args) => {
		await processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
		await archivePackageWhenFullyDone(ctx, args.packageId);
	}
});

export const processPackageAdjustmentWhenSessionsComplete = internalMutation({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) => {
		await processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
		await archivePackageWhenFullyDone(ctx, args.packageId);
	}
});

const requestArgs = { token: v.string(), date: v.string(), time: v.string(), now: v.number() };

export const validatePackageSessionRequest = internalQuery({
	args: requestArgs,
	handler: (ctx, args) =>
		loadValidPackageAndBookingSettings(ctx, args)
			.andThen(({ packageRecord, settings }) =>
				rejectPackageCreateWhenUnavailableOrFull(ctx, args, packageRecord, settings)
			)
			.andThen(({ packageRecord, settings }) =>
				parsePackageSessionCreateStartTime(args, packageRecord, settings)
			)
			.match(tupleOk, tupleErr)
});

export const validatePackageRescheduleRequest = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadEditablePackageSessionForReschedule(ctx, args)
			.andThen((details) => parsePackageRescheduleStartTime(args, details))
			.match(tupleOk, tupleErr)
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
		loadValidPackageAndCapacityConsumingSessions(ctx, args)
			.andThen(({ packageFromDb, packageSessions }) =>
				rejectFullPackageAndParseSessionStartTime(args, packageFromDb, packageSessions)
			)
			.andThen(({ packageFromDb, sessionStartAt }) =>
				insertPackageSessionBookingRow(ctx, args, packageFromDb, sessionStartAt)
			)
			.andThen(({ bookingId, packageFromDb }) =>
				clearPackageExpiryReminderStateWhenPending(ctx, packageFromDb, bookingId)
			)
			.andThen(({ bookingId, packageFromDb }) =>
				schedulePackageAdjustmentWhenAllSessionsBooked(ctx, packageFromDb._id, bookingId)
			)
			.match(tupleOk, tupleErr)
});

export const cancelPackageSession = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) =>
		findValidPackageByToken(ctx, args.token, args.now)
			.andThen((packageFromDb) =>
				loadPackageSessionOwnedByToken(ctx, packageFromDb, args.bookingId)
			)
			.andThen(() => cancelPackageSessionBooking(ctx, args.bookingId))
			.match(tupleOk, tupleErr)
});
