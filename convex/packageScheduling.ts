import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
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
import { env } from "./env";
import { getBookingSessionStartAt } from "./lib/bookingAdminEdit";
import type { BookingAvailabilitySettings } from "./lib/bookingCalendarTime";
import {
	bookingConsumesPackageCapacity,
	checkPackageBookingAvailability,
	getCapacityConsumingPackageBookings,
	getPackageBookingForToken,
	getValidPackageByToken,
	toPackageCalendarBooking,
	type CreatePackageBookingError,
	type ReschedulePackageBookingError,
	type UnschedulePackageBookingError,
	type ValidPackage
} from "./lib/packageScheduling";
import { isPackageSessionLocked } from "../src/sites/studio/features/booking-form/lib/package-scheduling-rules";
import { getPackageSessionAddons } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import { formatBookingInvoiceNumber } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	evaluatePackageAdjustment,
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE
} from "./lib/packageAdjustments";

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getPackageByTokenHandler(ctx, args)
});

async function getPackageByTokenHandler(ctx: QueryCtx, args: { token: string }) {
	const [lookupError, multiBooking] = await getValidPackageByToken(ctx, args.token, Date.now());

	if (lookupError !== null) {
		return err(lookupError);
	}

	const bookings = await getCapacityConsumingPackageBookings(
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
		bookings: bookings.map((booking) => ({
			_id: booking._id,
			date: booking.date,
			time: booking.time,
			sessionStartAt: booking.sessionStartAt,
			notes: booking.notes ?? "",
			service: booking.service,
			addons: booking.addons,
			...(booking.googleEventId ? { googleEventId: booking.googleEventId } : {})
		}))
	});
}

export type GetPackageByTokenResult = Awaited<ReturnType<typeof getPackageByTokenHandler>>;

const recordingSpaceValidator = v.union(v.literal("Table Setup"), v.literal("Armchair Setup"));

export const setDefaultSpace = mutation({
	args: { service: recordingSpaceValidator, token: v.string() },
	handler: (ctx, args) => setDefaultSpaceHandler(ctx, args)
});

async function setDefaultSpaceHandler(
	ctx: MutationCtx,
	args: { service: "Table Setup" | "Armchair Setup"; token: string }
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, Date.now());

	if (error !== null) {
		return err(error);
	}

	await ctx.db.patch(multiBooking._id, { defaultSpace: args.service });

	return ok({ defaultSpace: args.service });
}

export type SetDefaultSpaceResult = Awaited<ReturnType<typeof setDefaultSpaceHandler>>;

const packageBookingInput = {
	token: v.string(),
	date: v.string(),
	time: v.string(),
	service: recordingSpaceValidator,
	notes: v.optional(v.string()),
	remotePodcast: v.boolean()
};

export const createPackageBooking = action({
	args: packageBookingInput,
	handler: (ctx, args) => createPackageBookingHandler(ctx, args)
});

async function createPackageBookingHandler(
	ctx: ActionCtx,
	args: {
		token: string;
		date: string;
		time: string;
		service: "Table Setup" | "Armchair Setup";
		notes?: string;
		remotePodcast: boolean;
	}
): Promise<Result<{ bookingId: Id<"bookings"> }, CreatePackageBookingError>> {
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageBookingRequestInternal,
		{ token: args.token, date: args.date, time: args.time, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [rateError] = await ctx.runMutation(internal.bookings.checkBookingSubmitRateLimitInternal, {
		submitRateLimitKey: `package:${details.multiBooking._id}`
	});

	if (rateError !== null) {
		return err(rateError);
	}

	const [calendarError, calendar] = await ctx.runAction(
		internal.packageSchedulingCalendar.createPackageBookingCalendarEventInternal,
		{
			booking: null,
			details: toPackageCalendarDetails(args, details.multiBooking, details.eventBufferMinutes)
		}
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	const [databaseError, result] = await ctx.runMutation(
		internal.packageScheduling.saveCreatedPackageBookingInternal,
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
				internal.packageSchedulingCalendar.deletePackageBookingCalendarEventInternal,
				{
					booking: {
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

export type CreatePackageBookingResult = Awaited<ReturnType<typeof createPackageBookingHandler>>;

export const reschedulePackageBooking = action({
	args: { bookingId: v.id("bookings"), ...packageBookingInput },
	handler: (ctx, args) => reschedulePackageBookingHandler(ctx, args)
});

async function reschedulePackageBookingHandler(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		token: string;
		date: string;
		time: string;
		service: "Table Setup" | "Armchair Setup";
		notes?: string;
		remotePodcast: boolean;
	}
): Promise<Result<{ saved: true; bookingId: Id<"bookings"> }, ReschedulePackageBookingError>> {
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageRescheduleRequestInternal,
		{ token: args.token, bookingId: args.bookingId, date: args.date, time: args.time, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [reservationError, reservationResult] = await ctx.runMutation(
		internal.bookings.reserveBookingSlot,
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
	const timeLock = reservationResult.reservation;

	const [calendarError, calendar] = await ctx.runAction(
		internal.packageSchedulingCalendar.updatePackageBookingCalendarEventInternal,
		{
			booking: toPackageCalendarBooking(details.booking),
			details: toPackageCalendarDetails(args, details.multiBooking, details.eventBufferMinutes)
		}
	);

	if (calendarError !== null) {
		await ctx.runMutation(internal.bookings.clearBookingSlotReservation, {
			bookingId: args.bookingId,
			timeLock
		});
		return err(calendarError);
	}

	const [saveError, result] = await ctx.runMutation(
		internal.bookings.saveClientBookingRescheduleInternal,
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
			timeLock
		}
	);

	if (saveError !== null) {
		await ctx.runMutation(internal.bookings.clearBookingSlotReservation, {
			bookingId: args.bookingId,
			timeLock
		});
		return err(saveError);
	}

	return ok({ ...result, bookingId: args.bookingId });
}

export type ReschedulePackageBookingResult = Awaited<
	ReturnType<typeof reschedulePackageBookingHandler>
>;

export const unschedulePackageBooking = action({
	args: { bookingId: v.id("bookings"), token: v.string() },
	handler: (ctx, args) => unschedulePackageBookingHandler(ctx, args)
});

async function unschedulePackageBookingHandler(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; token: string }
): Promise<Result<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageBookingError>> {
	const now = Date.now();

	const [validationError, details] = await ctx.runQuery(
		internal.packageScheduling.validatePackageUnscheduleRequestInternal,
		{ ...args, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [calendarError] = await ctx.runAction(
		internal.packageSchedulingCalendar.deletePackageBookingCalendarEventInternal,
		{ booking: toPackageCalendarBooking(details.booking) }
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	const [saveError, result] = await ctx.runMutation(
		internal.packageScheduling.cancelPackageBookingInternal,
		{ bookingId: args.bookingId, now, token: args.token }
	);

	if (saveError !== null) {
		return err(saveError);
	}

	return ok(result);
}

export type UnschedulePackageBookingResult = Awaited<
	ReturnType<typeof unschedulePackageBookingHandler>
>;

export const getValidPackageByTokenInternal = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: (ctx, args) => getValidPackageByToken(ctx, args.token, args.now)
});

type ProcessPackageAdjustmentArgs =
	| { trigger: "all_sessions_completed"; multiBookingId: Id<"multiBookingPackages"> }
	| {
			trigger: "package_expired";
			multiBookingId: Id<"multiBookingPackages">;
			expectedExpiresAt: number;
	  };

export const processPackageAdjustmentAtExpiryInternal = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), expectedExpiresAt: v.number() },
	handler: (ctx, args) => processPackageAdjustment(ctx, { ...args, trigger: "package_expired" })
});

export const processPackageAdjustmentWhenSessionsCompleteInternal = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) =>
		processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" })
});

async function processPackageAdjustment(ctx: MutationCtx, args: ProcessPackageAdjustmentArgs) {
	const multiBooking = await ctx.db.get(args.multiBookingId);
	const isPackagePaidOrScheduleEmailFailed =
		multiBooking?.status === "paid" || multiBooking?.status === "schedule_email_failed";

	if (!multiBooking || !isPackagePaidOrScheduleEmailFailed) return null;

	if (args.trigger === "package_expired") {
		// Ignore stale expiry jobs and jobs that run before the package expires.
		if (multiBooking.expiresAt !== args.expectedExpiresAt || Date.now() < args.expectedExpiresAt) {
			return null;
		}
	}

	const existingAdjustment = await ctx.db
		.query("packageAdjustments")
		.withIndex("by_multiBookingId", (query) => query.eq("multiBookingId", args.multiBookingId))
		.unique();

	if (existingAdjustment) return null;

	const bookings = await getCapacityConsumingPackageBookings(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	// Closing before expiry requires every package session to be scheduled.
	if (args.trigger === "all_sessions_completed" && bookings.length !== multiBooking.packageSize) {
		return null;
	}

	const now = Date.now();
	const evaluation = evaluatePackageAdjustment(bookings, now);

	switch (evaluation.kind) {
		case "wait_for_sessions_to_end":
			// Re-evaluate when the final session ends.
			if (args.trigger === "package_expired") {
				await ctx.scheduler.runAt(
					evaluation.nextCheckAt,
					internal.packageScheduling.processPackageAdjustmentAtExpiryInternal,
					args
				);
				return null;
			}

			await ctx.scheduler.runAt(
				evaluation.nextCheckAt,
				internal.packageScheduling.processPackageAdjustmentWhenSessionsCompleteInternal,
				args
			);
			return null;

		case "invalid_duration":
			console.error("Package adjustment could not parse a session duration", {
				multiBookingId: args.multiBookingId
			});
			return null;

		case "ready": {
			const createdAt = now;

			if (evaluation.quantity === 0) {
				await ctx.db.insert("packageAdjustments", {
					outcome: "no_charge",
					multiBookingId: args.multiBookingId,
					trigger: args.trigger,
					remotePodcastBookingIds: [],
					quantity: 0,
					rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
					totalAmount: 0,
					createdAt
				});
				return null;
			}

			const adjustmentId = await ctx.db.insert("packageAdjustments", {
				outcome: "invoice_required",
				multiBookingId: args.multiBookingId,
				trigger: args.trigger,
				remotePodcastBookingIds: evaluation.remotePodcastBookingIds,
				quantity: evaluation.quantity,
				rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
				totalAmount: evaluation.totalAmount,
				invoiceNumber: "pending",
				createdAt,
				invoiceDueAt: createdAt + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
				invoiceEmailStatus: "pending",
				paymentStatus: "unpaid"
			});

			await ctx.db.patch(adjustmentId, {
				invoiceNumber: formatBookingInvoiceNumber(adjustmentId, createdAt)
			});
			await ctx.scheduler.runAfter(
				0,
				internal.packageAdjustmentInvoices.sendPackageAdjustmentInvoiceInternal,
				{ adjustmentId, attempt: "automatic" }
			);
			return null;
		}

		default: {
			const _exhaustive: never = evaluation;
			return _exhaustive;
		}
	}
}

const requestArgs = { token: v.string(), date: v.string(), time: v.string(), now: v.number() };

function toPackageCalendarDetails(
	args: {
		date: string;
		time: string;
		service: "Table Setup" | "Armchair Setup";
		remotePodcast: boolean;
	},
	multiBooking: ValidPackage,
	eventBufferMinutes: number
) {
	return {
		addons: getPackageSessionAddons(multiBooking.addons, args.remotePodcast),
		date: args.date,
		duration: multiBooking.duration,
		email: multiBooking.email,
		eventBufferMinutes,
		name: multiBooking.name,
		service: args.service,
		time: args.time
	};
}

function getPackageSessionStartAt(args: { date: string; time: string }) {
	return getBookingSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE);
}

export const validatePackageBookingRequestInternal = internalQuery({
	args: requestArgs,
	handler: (ctx, args) => validatePackageBookingRequest(ctx, args)
});

async function validatePackageBookingRequest(
	ctx: QueryCtx,
	args: { token: string; date: string; time: string; now: number }
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	const [availabilityError] = checkPackageBookingAvailability(
		args,
		multiBooking,
		settings,
		args.now
	);

	if (availabilityError !== null) {
		return err(availabilityError);
	}

	const bookings = await getCapacityConsumingPackageBookings(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	if (bookings.length >= multiBooking.packageSize) {
		return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
	}

	const [startError, sessionStartAt] = getPackageSessionStartAt(args);

	if (startError !== null) {
		return err(startError);
	}

	return ok({
		multiBooking,
		eventBufferMinutes: settings.eventBufferMinutes,
		leadTimeMinutes: settings.leadTimeMinutes,
		sessionStartAt
	});
}

export const validatePackageRescheduleRequestInternal = internalQuery({
	args: { ...requestArgs, bookingId: v.id("bookings") },
	handler: (ctx, args) => validatePackageRescheduleRequest(ctx, args)
});

async function validatePackageRescheduleRequest(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; date: string; time: string; now: number }
) {
	const [error, details] = await getEditablePackageBooking(ctx, args);

	if (error !== null) {
		return err(error);
	}

	const { booking, multiBooking, settings } = details;

	const [availabilityError] = checkPackageBookingAvailability(
		args,
		multiBooking,
		settings,
		args.now
	);

	if (availabilityError !== null) {
		return err(availabilityError);
	}

	const [startError, sessionStartAt] = getPackageSessionStartAt(args);

	if (startError !== null) {
		return err(startError);
	}

	return ok({
		booking,
		multiBooking,
		eventBufferMinutes: settings.eventBufferMinutes,
		sessionStartAt
	});
}

export const validatePackageUnscheduleRequestInternal = internalQuery({
	args: { token: v.string(), bookingId: v.id("bookings"), now: v.number() },
	handler: (ctx, args) => validatePackageUnscheduleRequest(ctx, args)
});

async function validatePackageUnscheduleRequest(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
) {
	const [error, details] = await getEditablePackageBooking(ctx, args);

	if (error !== null) {
		return err(error);
	}

	return ok({ booking: details.booking, multiBooking: details.multiBooking });
}

async function getEditablePackageBooking(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const booking = await getPackageBookingForToken(ctx, multiBooking._id, args.bookingId);

	if (!booking || !bookingConsumesPackageCapacity(booking)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	if (isPackageSessionLocked(booking.sessionStartAt, settings.leadTimeMinutes, args.now)) {
		return err({ reason: "PACKAGE_BOOKING_LOCKED" as const });
	}

	return ok({ booking, multiBooking, settings });
}

export const saveCreatedPackageBookingInternal = internalMutation({
	args: {
		...packageBookingInput,
		now: v.number(),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string())
	},
	handler: (ctx, args) => saveCreatedPackageBooking(ctx, args)
});

async function saveCreatedPackageBooking(
	ctx: MutationCtx,
	args: {
		token: string;
		date: string;
		time: string;
		service: "Table Setup" | "Armchair Setup";
		notes?: string;
		remotePodcast: boolean;
		now: number;
		googleCalendarId?: string;
		googleEventId?: string;
	}
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const activeBookings = await getCapacityConsumingPackageBookings(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	if (activeBookings.length >= multiBooking.packageSize) {
		return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
	}

	const [startError, sessionStartAt] = getPackageSessionStartAt(args);

	if (startError !== null) {
		return err(startError);
	}

	try {
		const bookingId = await ctx.db.insert("bookings", {
			name: multiBooking.name,
			phone: multiBooking.phone,
			accountName: multiBooking.accountName,
			abn: multiBooking.abn,
			email: multiBooking.email,
			instagramHandle: multiBooking.instagramHandle,
			date: args.date,
			time: args.time,
			sessionStartAt,
			duration: multiBooking.duration,
			service: args.service,
			addons: getPackageSessionAddons(multiBooking.addons, args.remotePodcast),
			essentialEditQuantity: multiBooking.essentialEditQuantity,
			clipsPackageQuantity: multiBooking.clipsPackageQuantity,
			notes: args.notes,
			status: "confirmed",
			pendingPaymentCreatedAt: multiBooking.createdAt,
			paymentCompletedAt: multiBooking.paidAt,
			bookingConfirmedAt: args.now,
			googleCalendarId: args.googleCalendarId,
			googleEventId: args.googleEventId,
			multiBookingPackageId: multiBooking._id
		});

		if (multiBooking.packageReminderState?.type === "expiry") {
			await ctx.db.patch(multiBooking._id, { packageReminderState: undefined });
		}

		await ctx.scheduler.runAfter(
			0,
			internal.packageScheduling.processPackageAdjustmentWhenSessionsCompleteInternal,
			{ multiBookingId: multiBooking._id }
		);

		return ok({ bookingId });
	} catch {
		return err({ reason: "PACKAGE_BOOKING_SAVE_FAILED" as const });
	}
}

export const cancelPackageBookingInternal = internalMutation({
	args: { bookingId: v.id("bookings"), token: v.string(), now: v.number() },
	handler: (ctx, args) => cancelPackageBooking(ctx, args)
});

async function cancelPackageBooking(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; token: string; now: number }
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const booking = await getPackageBookingForToken(ctx, multiBooking._id, args.bookingId);

	if (!booking || !bookingConsumesPackageCapacity(booking)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	try {
		await ctx.db.patch(args.bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			status: "cancelled"
		});
		await ctx.scheduler.runAfter(
			0,
			internal.packageScheduling.processPackageAdjustmentWhenSessionsCompleteInternal,
			{ multiBookingId: multiBooking._id }
		);

		return ok({ cancelled: true as const, bookingId: args.bookingId });
	} catch {
		return err({ reason: "PACKAGE_BOOKING_CANCEL_FAILED" as const });
	}
}
