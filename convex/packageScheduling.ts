import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action, internalMutation, mutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import { getValidPackageByToken as findValidPackageByToken } from "./lib/packageLookup";
import {
	cancelPackageSessionService,
	createPackageSessionService,
	getPackageByTokenService,
	processPackageAdjustmentAtExpiryService,
	processPackageAdjustmentWhenSessionsCompleteService,
	reschedulePackageSessionService,
	saveCreatedPackageSessionService,
	setPackageDefaultSpaceService,
	unschedulePackageSessionService,
	validatePackageRescheduleRequestService,
	validatePackageSessionRequestService,
	validatePackageUnscheduleRequestService
} from "./services/packageScheduling";

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
	handler: (ctx, args) => createPackageSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const reschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), ...packageSessionInput },
	handler: (ctx, args) => reschedulePackageSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const unschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), token: v.string() },
	handler: (ctx, args) => unschedulePackageSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const getValidPackageByToken = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: (ctx, args) =>
		findValidPackageByToken(ctx, args.token, args.now).match(tupleOk, tupleErr)
});

export const processPackageAdjustmentAtExpiry = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), expectedExpiresAt: v.number() },
	handler: (ctx, args) => processPackageAdjustmentAtExpiryService(ctx, args)
});

export const processPackageAdjustmentWhenSessionsComplete = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
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
	handler: (ctx, args) =>
		saveCreatedPackageSessionService(
			ctx,
			args,
			(packageId): Promise<unknown> =>
				ctx.scheduler.runAfter(
					0,
					internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
					{ multiBookingId: packageId }
				)
		).match(tupleOk, tupleErr)
});

export const cancelPackageSession = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) => cancelPackageSessionService(ctx, args).match(tupleOk, tupleErr)
});
