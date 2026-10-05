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
import { getValidPackageByToken as findValidPackageByToken } from "#convex/lib/packages/packageLookup";
import {
	cancelPackageSessionService,
	getPackageByTokenService,
	processPackageAdjustmentAtExpiryService,
	processPackageAdjustmentWhenSessionsCompleteService,
	saveCreatedPackageSessionService,
	setPackageDefaultSpaceService,
	validatePackageRescheduleRequestService,
	validatePackageSessionRequestService,
	validatePackageUnscheduleRequestService
} from "#convex/services/packages/packageScheduling";
import {
	authorizePackageSessionCreate,
	cleanupCancelledPackageDrive,
	clearPackageSessionCalendar,
	loadPackageRescheduleTarget,
	loadPackageUnscheduleTarget,
	markPackageSessionCancelled,
	persistNewPackageSession,
	persistPackageReschedule,
	reservePackageRescheduleSlot,
	syncNewPackageSessionCalendar,
	syncPackageRescheduleCalendar
} from "#convex/services/packages/packageSessionWorkflow";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getPackageByTokenService(ctx, args.token).match(tupleOk, tupleErr)
});

const recordingSpaceValidator = v.union(...SERVICES.map((service) => v.literal(service)));

export const setDefaultSpace = mutation({
	args: { service: recordingSpaceValidator, token: v.string() },
	handler: (ctx, args) => setPackageDefaultSpaceService(ctx, args).match(tupleOk, tupleErr)
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

		return authorizePackageSessionCreate(ctx, args, now)
			.andThen((details) => syncNewPackageSessionCalendar(ctx, args, details))
			.andThen(({ calendar, details }) =>
				persistNewPackageSession(ctx, args, now, calendar, details)
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
				persistPackageReschedule(ctx, args, details, calendar, reservation)
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
	handler: (ctx, args) => processPackageAdjustmentAtExpiryService(ctx, args)
});

export const processPackageAdjustmentWhenSessionsComplete = internalMutation({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => processPackageAdjustmentWhenSessionsCompleteService(ctx, args)
});

const requestArgs = { token: v.string(), date: v.string(), time: v.string(), now: v.number() };

export const validatePackageSessionRequest = internalQuery({
	args: requestArgs,
	handler: (ctx, args) => validatePackageSessionRequestService(ctx, args).match(tupleOk, tupleErr)
});

export const validatePackageRescheduleRequest = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		validatePackageRescheduleRequestService(ctx, args).match(tupleOk, tupleErr)
});

export const validatePackageUnscheduleRequest = internalQuery({
	args: { token: v.string(), bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) =>
		validatePackageUnscheduleRequestService(ctx, args).match(tupleOk, tupleErr)
});

export const saveCreatedPackageSession = internalMutation({
	args: {
		...packageSessionInput,
		now: v.number(),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string())
	},
	handler: (ctx, args) => saveCreatedPackageSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const cancelPackageSession = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) => cancelPackageSessionService(ctx, args).match(tupleOk, tupleErr)
});
