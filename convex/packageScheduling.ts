import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	mutation,
	internalQuery,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
	SERVICES,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "./lib/packageScheduling";
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
	validatePackageUnscheduleRequestService,
	type CancelPackageSessionArgs,
	type PackageRescheduleRequestDetails,
	type PackageSessionRequestDetails,
	type PackageUnscheduleRequestDetails,
	type SaveCreatedPackageSessionArgs
} from "./services/packageScheduling";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getPackageByTokenHandler(ctx, args)
});

async function getPackageByTokenHandler(ctx: QueryCtx, args: { token: string }) {
	return await getPackageByTokenService(ctx, args.token).match(tupleOk, tupleErr);
}

export type GetPackageByTokenResult = Awaited<ReturnType<typeof getPackageByTokenHandler>>;

const recordingSpaceValidator = v.union(...SERVICES.map((service) => v.literal(service)));
type RecordingSpace = Exclude<BookingFormValues["service"], "">;

export const setDefaultSpace = mutation({
	args: { service: recordingSpaceValidator, token: v.string() },
	handler: (ctx, args) => setDefaultSpaceHandler(ctx, args)
});

async function setDefaultSpaceHandler(
	ctx: MutationCtx,
	args: { service: RecordingSpace; token: string }
) {
	return await setPackageDefaultSpaceService(ctx, args).match(tupleOk, tupleErr);
}

export type SetDefaultSpaceResult = Awaited<ReturnType<typeof setDefaultSpaceHandler>>;

const packageSessionInput = {
	token: v.string(),
	date: v.string(),
	time: v.string(),
	service: recordingSpaceValidator,
	notes: v.optional(v.string()),
	remotePodcast: v.boolean()
};

type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: RecordingSpace;
	notes?: string;
	remotePodcast: boolean;
};

export const createPackageSession = action({
	args: packageSessionInput,
	handler: (ctx, args) => createPackageSessionHandler(ctx, args)
});

async function createPackageSessionHandler(
	ctx: ActionCtx,
	args: PackageSessionArgs
): Promise<Result<{ bookingId: Id<"bookings"> }, CreatePackageSessionError>> {
	return createPackageSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type CreatePackageSessionResult = Awaited<ReturnType<typeof createPackageSessionHandler>>;

type ReschedulePackageSessionArgs = PackageSessionArgs & { bookingId: Id<"bookings"> };

export const reschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), ...packageSessionInput },
	handler: (ctx, args) => reschedulePackageSessionHandler(ctx, args)
});

async function reschedulePackageSessionHandler(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs
): Promise<Result<{ bookingId: Id<"bookings"> }, ReschedulePackageSessionError>> {
	return reschedulePackageSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type ReschedulePackageSessionResult = Awaited<
	ReturnType<typeof reschedulePackageSessionHandler>
>;

type UnschedulePackageSessionArgs = { bookingId: Id<"bookings">; token: string };

export const unschedulePackageSession = action({
	args: { bookingId: v.id("bookings"), token: v.string() },
	handler: (ctx, args) => unschedulePackageSessionHandler(ctx, args)
});

async function unschedulePackageSessionHandler(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs
): Promise<Result<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError>> {
	return unschedulePackageSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type UnschedulePackageSessionResult = Awaited<
	ReturnType<typeof unschedulePackageSessionHandler>
>;

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

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };

export const validatePackageSessionRequest = internalQuery({
	args: requestArgs,
	handler: (ctx, args) => validatePackageSessionRequestHandler(ctx, args)
});

async function validatePackageSessionRequestHandler(
	ctx: QueryCtx,
	args: PackageSessionRequestArgs
): Promise<Result<PackageSessionRequestDetails, CreatePackageSessionError>> {
	return validatePackageSessionRequestService(ctx, args).match(tupleOk, tupleErr);
}

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

export const validatePackageRescheduleRequest = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) => validatePackageRescheduleRequestHandler(ctx, args)
});

async function validatePackageRescheduleRequestHandler(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
): Promise<Result<PackageRescheduleRequestDetails, ReschedulePackageSessionError>> {
	return validatePackageRescheduleRequestService(ctx, args).match(tupleOk, tupleErr);
}

type PackageUnscheduleRequestArgs = UnschedulePackageSessionArgs & { now: number };

export const validatePackageUnscheduleRequest = internalQuery({
	args: { token: v.string(), bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => validatePackageUnscheduleRequestHandler(ctx, args)
});

async function validatePackageUnscheduleRequestHandler(
	ctx: QueryCtx,
	args: PackageUnscheduleRequestArgs
): Promise<Result<PackageUnscheduleRequestDetails, UnschedulePackageSessionError>> {
	return validatePackageUnscheduleRequestService(ctx, args).match(tupleOk, tupleErr);
}

export const saveCreatedPackageSession = internalMutation({
	args: {
		...packageSessionInput,
		now: v.number(),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string())
	},
	handler: (ctx, args) => saveCreatedPackageSessionHandler(ctx, args)
});

async function saveCreatedPackageSessionHandler(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs
): Promise<Result<{ bookingId: Id<"bookings"> }, CreatePackageSessionError>> {
	return saveCreatedPackageSessionService(
		ctx,
		args,
		(packageId): Promise<unknown> =>
			ctx.scheduler.runAfter(
				0,
				internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
				{ multiBookingId: packageId }
			)
	).match(tupleOk, tupleErr);
}

export const cancelPackageSession = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) => cancelPackageSessionHandler(ctx, args)
});

async function cancelPackageSessionHandler(
	ctx: MutationCtx,
	args: CancelPackageSessionArgs
): Promise<Result<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError>> {
	return cancelPackageSessionService(ctx, args).match(tupleOk, tupleErr);
}
