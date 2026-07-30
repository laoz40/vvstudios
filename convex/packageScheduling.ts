import { v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk, type Result } from "#/lib/result";
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
import { api, internal } from "./_generated/api";
import {
	getPackageSessionAddons,
	SERVICES,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { SessionAvailabilitySettings } from "./lib/sessionCalendarTime";
import {
	checkPackageSessionAvailability,
	getCapacityConsumingPackageSessions,
	getEditablePackageSession,
	getPackageSessionStartAt,
	getValidPackageByToken as findValidPackageByToken,
	toPackageCalendarSession,
	toPackageCalendarDetails,
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "./lib/packageScheduling";
import { processPackageAdjustment } from "./lib/packageAdjustments";
import {
	cancelPackageSessionService,
	saveCreatedPackageSessionService,
	type CancelPackageSessionArgs,
	type SaveCreatedPackageSessionArgs
} from "./services/packageScheduling";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getPackageByTokenHandler(ctx, args)
});

async function getPackageByTokenHandler(ctx: QueryCtx, args: { token: string }) {
	const [lookupError, multiBooking] = await findValidPackageByToken(ctx, args.token, Date.now());

	if (lookupError !== null) {
		return err(lookupError);
	}

	const sessions = await getCapacityConsumingPackageSessions(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	return ok({
		_id: multiBooking._id,
		name: multiBooking.name,
		email: multiBooking.email,
		duration: multiBooking.duration,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity,
		clipsPackageQuantity: multiBooking.clipsPackageQuantity,
		packageSize: multiBooking.packageSize,
		expiresAt: multiBooking.expiresAt,
		defaultSpace: multiBooking.defaultSpace,
		sessions: sessions.map((session) => ({
			_id: session._id,
			date: session.date,
			time: session.time,
			sessionStartAt: session.sessionStartAt,
			notes: session.notes ?? "",
			service: session.service,
			addons: session.addons,
			...(session.googleEventId ? { googleEventId: session.googleEventId } : {})
		}))
	});
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
	const [error, multiBooking] = await findValidPackageByToken(ctx, args.token, Date.now());

	if (error !== null) {
		return err(error);
	}

	await ctx.db.patch(multiBooking._id, { defaultSpace: args.service });

	return ok({ defaultSpace: args.service });
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
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageSessionRequest,
		{ token: args.token, date: args.date, time: args.time, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [rateError] = await ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, {
		submitRateLimitKey: `package:${details.multiBooking._id}`
	});

	if (rateError !== null) {
		return err(rateError);
	}

	const [calendarError, calendar] = await ctx.runAction(
		internal.packageSchedulingCalendar.createPackageSessionCalendarEvent,
		{
			session: null,
			details: toPackageCalendarDetails(args, details.multiBooking, details.eventBufferMinutes)
		}
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	const [databaseError, result] = await ctx.runMutation(
		internal.packageScheduling.saveCreatedPackageSession,
		{
			...args,
			now,
			...(calendar.googleCalendarId ? { googleCalendarId: calendar.googleCalendarId } : {}),
			...(calendar.googleEventId ? { googleEventId: calendar.googleEventId } : {})
		}
	);

	if (databaseError !== null) {
		if (calendar.googleEventId && calendar.googleCalendarId) {
			const [cleanupError] = await ctx.runAction(
				internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent,
				{
					session: {
						date: args.date,
						duration: details.multiBooking.duration,
						email: details.multiBooking.email,
						googleCalendarId: calendar.googleCalendarId,
						googleEventId: calendar.googleEventId,
						name: details.multiBooking.name,
						time: args.time
					}
				}
			);
			if (cleanupError !== null) {
				console.error("Failed to compensate orphan package Calendar event", cleanupError);
			}
		}

		return err(databaseError);
	}

	return ok(result);
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
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageRescheduleRequest,
		{ token: args.token, bookingId: args.bookingId, date: args.date, time: args.time, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [reservationError, reservationResult] = await ctx.runMutation(
		internal.sessionScheduling.reserveSessionReservation,
		{
			bookingId: args.bookingId,
			duration: details.multiBooking.duration,
			eventBufferMinutes: details.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: details.sessionStartAt
		}
	);
	if (reservationError !== null || reservationResult.outcome === "unavailable") {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}
	const reservation = reservationResult.reservation;

	const [calendarError, calendar] = await ctx.runAction(
		internal.packageSchedulingCalendar.updatePackageSessionCalendarEvent,
		{
			session: toPackageCalendarSession(details.session),
			details: toPackageCalendarDetails(args, details.multiBooking, details.eventBufferMinutes)
		}
	);

	if (calendarError !== null) {
		await ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: args.bookingId,
			reservation
		});
		return err(calendarError);
	}

	const [saveError] = await ctx.runMutation(
		internal.sessionScheduling.saveClientSessionReschedule,
		{
			bookingId: args.bookingId,
			date: args.date,
			time: args.time,
			service: args.service,
			notes: args.notes,
			addons: getPackageSessionAddons(details.multiBooking.addons, args.remotePodcast),
			sessionStartAt: details.sessionStartAt,
			googleCalendarId: calendar.googleCalendarId,
			googleEventId: calendar.googleEventId,
			multiBookingPackageId: details.multiBooking._id,
			reservation
		}
	);

	if (saveError !== null) {
		await ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId: args.bookingId,
			reservation
		});
		return err(saveError);
	}

	return ok({ bookingId: args.bookingId });
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
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageUnscheduleRequest,
		{ ...args, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [calendarError] = await ctx.runAction(
		internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent,
		{ session: toPackageCalendarSession(details.session) }
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	const [saveError, result] = await ctx.runMutation(
		internal.packageScheduling.cancelPackageSession,
		{ bookingId: args.bookingId, now, token: args.token }
	);

	if (saveError !== null) {
		return err(saveError);
	}

	return ok(result);
}

export type UnschedulePackageSessionResult = Awaited<
	ReturnType<typeof unschedulePackageSessionHandler>
>;

export const getValidPackageByToken = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: (ctx, args) => findValidPackageByToken(ctx, args.token, args.now)
});

export const processPackageAdjustmentAtExpiry = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), expectedExpiresAt: v.number() },
	handler: (ctx, args) => processPackageAdjustment(ctx, { ...args, trigger: "package_expired" })
});

export const processPackageAdjustmentWhenSessionsComplete = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) =>
		processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" })
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
) {
	const [error, multiBooking] = await findValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const settings: SessionAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	const [availabilityError] = checkPackageSessionAvailability(
		args,
		multiBooking,
		settings,
		args.now
	);

	if (availabilityError !== null) {
		return err(availabilityError);
	}

	const bookings = await getCapacityConsumingPackageSessions(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	if (bookings.length >= multiBooking.packageSize) {
		return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
	}

	const sessionStartResult = getPackageSessionStartAt(args);

	if (sessionStartResult.isErr()) {
		return err(sessionStartResult.error);
	}

	return ok({
		multiBooking,
		eventBufferMinutes: settings.eventBufferMinutes,
		leadTimeMinutes: settings.leadTimeMinutes,
		sessionStartAt: sessionStartResult.value
	});
}

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

export const validatePackageRescheduleRequest = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) => validatePackageRescheduleRequestHandler(ctx, args)
});

async function validatePackageRescheduleRequestHandler(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
) {
	const [error, details] = await getEditablePackageSession(ctx, args);

	if (error !== null) {
		return err(error);
	}

	const { session, multiBooking, settings } = details;

	const [availabilityError] = checkPackageSessionAvailability(
		args,
		multiBooking,
		settings,
		args.now
	);

	if (availabilityError !== null) {
		return err(availabilityError);
	}

	const sessionStartResult = getPackageSessionStartAt(args);

	if (sessionStartResult.isErr()) {
		return err(sessionStartResult.error);
	}

	return ok({
		session,
		multiBooking,
		eventBufferMinutes: settings.eventBufferMinutes,
		sessionStartAt: sessionStartResult.value
	});
}

type PackageUnscheduleRequestArgs = UnschedulePackageSessionArgs & { now: number };

export const validatePackageUnscheduleRequest = internalQuery({
	args: { token: v.string(), bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => validatePackageUnscheduleRequestHandler(ctx, args)
});

async function validatePackageUnscheduleRequestHandler(
	ctx: QueryCtx,
	args: PackageUnscheduleRequestArgs
) {
	const [error, details] = await getEditablePackageSession(ctx, args);

	if (error !== null) {
		return err(error);
	}

	return ok({ session: details.session, multiBooking: details.multiBooking });
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
