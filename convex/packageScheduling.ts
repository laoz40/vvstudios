import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { hashRescheduleToken } from "./lib/bookingRescheduleLinks";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import {
	checkBookingMeetsAvailabilitySettings,
	type BookingAvailabilitySettings,
	type BookingAvailabilityValidationError
} from "./lib/bookingCalendarTime";
import { env } from "./env";
import { api, internal } from "./_generated/api";
import { getBookingSessionStartAt } from "./lib/bookingAdminEdit";
import { isPackageSessionLocked } from "../src/sites/studio/features/booking-form/lib/package-scheduling-rules";
import type { BookingCalendarEventRecord } from "./lib/googleCalendarEvents";

export type ValidPackageByTokenError =
	| { reason: "PACKAGE_LINK_INVALID" }
	| { reason: "PACKAGE_LINK_EXPIRED" }
	| { reason: "PACKAGE_LINK_INACTIVE" }
	| { reason: "PACKAGE_NOT_PAID" };

export type ValidPackage = Doc<"multiBookingPackages"> & { expiresAt: number };

type PackageSlotLookupError =
	| ValidPackageByTokenError
	| { reason: "PACKAGE_SLOT_NOT_FOUND" }
	| { reason: "PACKAGE_SLOT_LOCKED" };

type PackageSessionView = {
	booking: null | {
		date: string;
		googleCalendarId?: string;
		googleEventId?: string;
		sessionStartAt: number;
		time: string;
	};
	cancelledAt?: number;
	scheduledAt?: number;
	slotNumber: number;
};

type PackageSlotSavePreparation = {
	booking: Doc<"bookings"> | null;
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	multiBooking: ValidPackage;
	sessionStartAt: number;
};

type SaveScheduledPackageSlotArgs = {
	date: string;
	googleCalendarId?: string;
	googleEventId?: string;
	leadTimeMinutes: number;
	now: number;
	slotNumber: number;
	time: string;
	token: string;
};

export const getPackageByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getPackageByTokenHandler(ctx, args)
});

async function getPackageByTokenHandler(ctx: QueryCtx, args: { token: string }) {
	const [lookupError, multiBooking] = await getValidPackageByToken(ctx, args.token, Date.now());

	if (lookupError !== null) {
		return err(lookupError);
	}

	const sessions = await buildPackageSessionViews(ctx, multiBooking);

	return ok({
		_id: multiBooking._id,
		name: multiBooking.name,
		email: multiBooking.email,
		duration: multiBooking.duration,
		service: multiBooking.service,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity,
		clipsPackageQuantity: multiBooking.clipsPackageQuantity,
		notes: multiBooking.notes,
		packageSize: multiBooking.packageSize,
		expiresAt: multiBooking.expiresAt,
		sessions
	});
}

export type GetPackageByTokenResult = Awaited<ReturnType<typeof getPackageByTokenHandler>>;

export const savePackageSlot = action({
	args: { token: v.string(), slotNumber: v.number(), date: v.string(), time: v.string() },
	handler: (ctx, args) => savePackageSlotHandler(ctx, args)
});

async function savePackageSlotHandler(
	ctx: ActionCtx,
	args: { date: string; slotNumber: number; time: string; token: string }
): Promise<
	Result<
		{ bookingId: Id<"bookings">; slotNumber: number },
		| PackageSlotLookupError
		| { reason: "BOOKING_INVALID_DATE" }
		| { reason: "BOOKING_INVALID_DURATION" }
		| { reason: "BOOKING_INVALID_TIME" }
		| { reason: "BOOKING_OUTSIDE_OPENING_HOURS" }
		| { reason: "BOOKING_TIME_UNAVAILABLE" }
		| { reason: "BOOKING_TOO_FAR_AHEAD" }
		| { reason: "BOOKING_TOO_SOON" }
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
		| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
		| { reason: "GOOGLE_CALENDAR_CREATE_FAILED" }
		| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
		| { reason: "GOOGLE_CALENDAR_UPDATE_FAILED" }
		| { reason: "PACKAGE_SLOT_SAVE_FAILED" }
	>
> {
	const now = Date.now();

	const [validationError, details]: ValidatePackageSlotSaveRequestResult = await ctx.runQuery(
		internal.packageScheduling.validatePackageSlotSaveRequestInternal,
		{ ...args, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [rateLimitError] = await ctx.runMutation(
		internal.bookings.checkBookingSubmitRateLimitInternal,
		{ submitRateLimitKey: `package:${details.multiBooking._id}` }
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	// Create or update the Calendar event while ignoring this booking on reschedule.
	const calendarBooking = details.booking ? buildPackageCalendarBooking(details.booking) : null;
	const [calendarError, calendarResult] = await ctx.runAction(
		internal.packageSchedulingCalendar.savePackageSlotCalendarEventInternal,
		{
			booking: calendarBooking,
			details: {
				addons: details.multiBooking.addons,
				date: args.date,
				duration: details.multiBooking.duration,
				email: details.multiBooking.email,
				eventBufferMinutes: details.eventBufferMinutes,
				name: details.multiBooking.name,
				service: details.multiBooking.service,
				time: args.time
			}
		}
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	// Save the booking/session change in Convex with the Calendar event ids.
	const [databaseError, databaseResult]: SaveScheduledPackageSlotResult = await ctx.runMutation(
		internal.packageScheduling.saveScheduledPackageSlotInternal,
		{
			date: args.date,
			leadTimeMinutes: details.leadTimeMinutes,
			now,
			slotNumber: args.slotNumber,
			time: args.time,
			token: args.token,
			...(calendarResult.googleCalendarId
				? { googleCalendarId: calendarResult.googleCalendarId }
				: {}),
			...(calendarResult.googleEventId ? { googleEventId: calendarResult.googleEventId } : {})
		}
	);

	if (databaseError !== null) {
		return err(databaseError);
	}

	return ok(databaseResult);
}

export type SavePackageSlotResult = Awaited<ReturnType<typeof savePackageSlotHandler>>;

export const clearPackageSlot = action({
	args: { token: v.string(), slotNumber: v.number() },
	handler: (ctx, args) => clearPackageSlotHandler(ctx, args)
});

async function clearPackageSlotHandler(
	ctx: ActionCtx,
	args: { slotNumber: number; token: string }
): Promise<
	Result<
		{ cleared: true; slotNumber: number },
		| PackageSlotLookupError
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
		| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
		| { reason: "GOOGLE_CALENDAR_DELETE_FAILED" }
		| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
		| { reason: "PACKAGE_SLOT_CLEAR_FAILED" }
	>
> {
	const now = Date.now();

	const [validationError, details]: ValidatePackageSlotClearRequestResult = await ctx.runQuery(
		internal.packageScheduling.validatePackageSlotClearRequestInternal,
		{ ...args, now }
	);

	if (validationError !== null) {
		return err(validationError);
	}

	const [rateLimitError] = await ctx.runMutation(
		internal.bookings.checkBookingSubmitRateLimitInternal,
		{ submitRateLimitKey: `package:${details.multiBooking._id}` }
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	// Delete the Calendar event
	const calendarBooking = buildPackageCalendarBooking(details.booking);
	const [calendarError] = await ctx.runAction(
		internal.packageSchedulingCalendar.deletePackageSlotCalendarEventInternal,
		{ booking: calendarBooking }
	);

	if (calendarError !== null) {
		return err(calendarError);
	}

	// Save the cancellation in Convex
	const [databaseError, databaseResult]: SaveClearedPackageSlotResult = await ctx.runMutation(
		internal.packageScheduling.saveClearedPackageSlotInternal,
		{ ...args, leadTimeMinutes: details.leadTimeMinutes, now }
	);

	if (databaseError !== null) {
		return err(databaseError);
	}

	return ok(databaseResult);
}

export type ClearPackageSlotResult = Awaited<ReturnType<typeof clearPackageSlotHandler>>;

export const getValidPackageByTokenInternal = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: async (ctx, args) => getValidPackageByToken(ctx, args.token, args.now)
});

export const getPackageSlotCalendarEventInternal = internalQuery({
	args: { token: v.string(), slotNumber: v.number() },
	handler: async (ctx, args) => {
		const [lookupError, lookup] = await getEditablePackageSlot(
			ctx,
			args.token,
			args.slotNumber,
			0,
			Date.now()
		);

		if (lookupError !== null || !lookup.slot.bookingId) {
			return null;
		}

		const booking = await ctx.db.get(lookup.slot.bookingId);

		if (!booking || booking.status === "cancelled" || !booking.googleEventId) {
			return null;
		}

		return {
			...(booking.googleCalendarId ? { calendarId: booking.googleCalendarId } : {}),
			eventId: booking.googleEventId
		};
	}
});

export const validatePackageSlotSaveRequestInternal = internalQuery({
	args: {
		date: v.string(),
		now: v.number(),
		slotNumber: v.number(),
		time: v.string(),
		token: v.string()
	},
	handler: (ctx, args) => validatePackageSlotSaveRequestInternalHandler(ctx, args)
});

async function validatePackageSlotSaveRequestInternalHandler(
	ctx: QueryCtx,
	args: { date: string; now: number; slotNumber: number; time: string; token: string }
): Promise<
	Result<PackageSlotSavePreparation, PackageSlotLookupError | BookingAvailabilityValidationError>
> {
	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});
	const [lookupError, lookup] = await getEditablePackageSlot(
		ctx,
		args.token,
		args.slotNumber,
		settings.leadTimeMinutes,
		args.now
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const [availabilityError] = checkBookingMeetsAvailabilitySettings({
		date: args.date,
		duration: lookup.multiBooking.duration,
		latestBookableDate: new Date(lookup.multiBooking.expiresAt),
		now: args.now,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	});

	if (availabilityError !== null) {
		return err(availabilityError);
	}

	const [sessionStartError, sessionStartAt] = getBookingSessionStartAt(
		args.date,
		args.time,
		env.GOOGLE_CALENDAR_TIMEZONE
	);

	if (sessionStartError !== null) {
		return err(sessionStartError);
	}

	const booking = lookup.slot.bookingId ? await ctx.db.get(lookup.slot.bookingId) : null;
	const activeBooking = booking && booking.status !== "cancelled" ? booking : null;

	return ok({
		booking: activeBooking,
		eventBufferMinutes: settings.eventBufferMinutes,
		leadTimeMinutes: settings.leadTimeMinutes,
		multiBooking: lookup.multiBooking,
		sessionStartAt
	});
}

type ValidatePackageSlotSaveRequestResult = Awaited<
	ReturnType<typeof validatePackageSlotSaveRequestInternalHandler>
>;

export const validatePackageSlotClearRequestInternal = internalQuery({
	args: { now: v.number(), slotNumber: v.number(), token: v.string() },
	handler: (ctx, args) => validatePackageSlotClearRequestInternalHandler(ctx, args)
});

async function validatePackageSlotClearRequestInternalHandler(
	ctx: QueryCtx,
	args: { now: number; slotNumber: number; token: string }
): Promise<
	Result<
		{ booking: Doc<"bookings">; leadTimeMinutes: number; multiBooking: ValidPackage },
		PackageSlotLookupError
	>
> {
	const settings: BookingAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});
	const [lookupError, lookup] = await getEditablePackageSlot(
		ctx,
		args.token,
		args.slotNumber,
		settings.leadTimeMinutes,
		args.now
	);
	if (lookupError !== null) {
		return err(lookupError);
	}

	if (!lookup.slot.bookingId || lookup.slot.cancelledAt) {
		return err({ reason: "PACKAGE_SLOT_NOT_FOUND" });
	}

	const booking = await ctx.db.get(lookup.slot.bookingId);

	if (!booking || booking.status === "cancelled") {
		return err({ reason: "PACKAGE_SLOT_NOT_FOUND" });
	}

	return ok({
		booking,
		leadTimeMinutes: settings.leadTimeMinutes,
		multiBooking: lookup.multiBooking
	});
}

type ValidatePackageSlotClearRequestResult = Awaited<
	ReturnType<typeof validatePackageSlotClearRequestInternalHandler>
>;

export const saveScheduledPackageSlotInternal = internalMutation({
	args: {
		date: v.string(),
		googleCalendarId: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		leadTimeMinutes: v.number(),
		now: v.number(),
		slotNumber: v.number(),
		time: v.string(),
		token: v.string()
	},
	handler: (ctx, args) => saveScheduledPackageSlotInternalHandler(ctx, args)
});

async function saveScheduledPackageSlotInternalHandler(
	ctx: MutationCtx,
	args: SaveScheduledPackageSlotArgs
) {
	// Re-check inside the mutation so stale action data cannot write over changed state.
	const [lookupError, lookup] = await getEditablePackageSlot(
		ctx,
		args.token,
		args.slotNumber,
		args.leadTimeMinutes,
		args.now
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	// Calculate this again inside the DB write from the exact saved date/time.
	const [sessionStartError, sessionStartAt] = getBookingSessionStartAt(
		args.date,
		args.time,
		env.GOOGLE_CALENDAR_TIMEZONE
	);

	if (sessionStartError !== null) {
		return err(sessionStartError);
	}

	try {
		let bookingId = lookup.slot.bookingId;

		// New package slot: create a normal booking row linked back to the package.
		if (!bookingId) {
			bookingId = await ctx.db.insert("bookings", {
				name: lookup.multiBooking.name,
				phone: lookup.multiBooking.phone,
				accountName: lookup.multiBooking.accountName,
				abn: lookup.multiBooking.abn,
				email: lookup.multiBooking.email,
				instagramHandle: lookup.multiBooking.instagramHandle,
				date: args.date,
				time: args.time,
				sessionStartAt,
				duration: lookup.multiBooking.duration,
				service: lookup.multiBooking.service,
				addons: lookup.multiBooking.addons,
				essentialEditQuantity: lookup.multiBooking.essentialEditQuantity,
				clipsPackageQuantity: lookup.multiBooking.clipsPackageQuantity,
				notes: lookup.multiBooking.notes,
				status: "confirmed",
				pendingPaymentCreatedAt: lookup.multiBooking.createdAt,
				paymentCompletedAt: lookup.multiBooking.paidAt,
				bookingConfirmedAt: args.now,
				googleCalendarId: args.googleCalendarId,
				googleEventId: args.googleEventId,
				multiBookingPackageId: lookup.multiBooking._id,
				multiBookingSlotNumber: args.slotNumber
			});
		}

		// Existing package slot: move it and make it active again.
		if (lookup.slot.bookingId) {
			await ctx.db.patch(lookup.slot.bookingId, {
				bookingConfirmedAt: args.now,
				bookingFailureCode: undefined,
				date: args.date,
				googleCalendarId: args.googleCalendarId,
				googleEventId: args.googleEventId,
				sessionStartAt,
				status: "confirmed",
				time: args.time,
				reminderEmailClaimedAt: undefined,
				reminderEmailSentAt: undefined,
				reminderEmailFailureCode: undefined
			});
		}

		// Store the booking id and scheduled time on the package session.
		await ctx.db.patch(lookup.multiBooking._id, {
			sessions: lookup.multiBooking.sessions.map((session) =>
				session.slotNumber === args.slotNumber
					? { bookingId, scheduledAt: args.now, slotNumber: session.slotNumber }
					: session
			)
		});

		return ok({ bookingId, slotNumber: args.slotNumber });
	} catch {
		return err({ reason: "PACKAGE_SLOT_SAVE_FAILED" });
	}
}

type SaveScheduledPackageSlotResult = Awaited<
	ReturnType<typeof saveScheduledPackageSlotInternalHandler>
>;

export const saveClearedPackageSlotInternal = internalMutation({
	args: { leadTimeMinutes: v.number(), now: v.number(), slotNumber: v.number(), token: v.string() },
	handler: (ctx, args) => saveClearedPackageSlotInternalHandler(ctx, args)
});

async function saveClearedPackageSlotInternalHandler(
	ctx: MutationCtx,
	args: { leadTimeMinutes: number; now: number; slotNumber: number; token: string }
) {
	// Re-check inside the mutation so stale action data cannot write over changed state.
	const [lookupError, lookup] = await getEditablePackageSlot(
		ctx,
		args.token,
		args.slotNumber,
		args.leadTimeMinutes,
		args.now
	);

	if (lookupError !== null) {
		return err(lookupError);
	}

	if (!lookup.slot.bookingId) {
		return err({ reason: "PACKAGE_SLOT_NOT_FOUND" });
	}

	try {
		// Keep the booking row for history, but mark it inactive for admin/reminders.
		await ctx.db.patch(lookup.slot.bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			status: "cancelled"
		});

		// Keep the booking id on the package session and record when it was cleared.
		await ctx.db.patch(lookup.multiBooking._id, {
			sessions: lookup.multiBooking.sessions.map((session) =>
				session.slotNumber === args.slotNumber
					? { bookingId: session.bookingId, cancelledAt: args.now, slotNumber: session.slotNumber }
					: session
			)
		});

		return ok({ cleared: true as const, slotNumber: args.slotNumber });
	} catch {
		return err({ reason: "PACKAGE_SLOT_CLEAR_FAILED" });
	}
}

type SaveClearedPackageSlotResult = Awaited<
	ReturnType<typeof saveClearedPackageSlotInternalHandler>
>;

function buildPackageCalendarBooking(booking: Doc<"bookings">): BookingCalendarEventRecord {
	return {
		date: booking.date,
		duration: booking.duration,
		email: booking.email,
		name: booking.name,
		time: booking.time,
		...(booking.googleCalendarId ? { googleCalendarId: booking.googleCalendarId } : {}),
		...(booking.googleEventId ? { googleEventId: booking.googleEventId } : {})
	};
}
async function getValidPackageByToken(
	ctx: QueryCtx | MutationCtx,
	token: string,
	now: number
): Promise<Result<ValidPackage, ValidPackageByTokenError>> {
	const scheduleTokenHash = await hashRescheduleToken(token);
	const multiBooking = await ctx.db
		.query("multiBookingPackages")
		.withIndex("by_scheduleTokenHash", (q) => q.eq("scheduleTokenHash", scheduleTokenHash))
		.unique();

	if (!multiBooking) {
		return err({ reason: "PACKAGE_LINK_INVALID" });
	}

	if (multiBooking.status !== "paid" && multiBooking.status !== "schedule_email_failed") {
		return err({ reason: "PACKAGE_NOT_PAID" });
	}

	if (multiBooking.scheduleLinkStatus !== "active") {
		return err({ reason: "PACKAGE_LINK_INACTIVE" });
	}

	if (multiBooking.expiresAt === undefined || now >= multiBooking.expiresAt) {
		return err({ reason: "PACKAGE_LINK_EXPIRED" });
	}

	return ok({ ...multiBooking, expiresAt: multiBooking.expiresAt });
}

async function getEditablePackageSlot(
	ctx: QueryCtx | MutationCtx,
	token: string,
	slotNumber: number,
	leadTimeMinutes: number,
	now: number
): Promise<
	Result<
		{ multiBooking: ValidPackage; slot: Doc<"multiBookingPackages">["sessions"][number] },
		PackageSlotLookupError
	>
> {
	const [lookupError, multiBooking] = await getValidPackageByToken(ctx, token, now);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const slot = multiBooking.sessions.find((session) => session.slotNumber === slotNumber);

	if (!slot) {
		return err({ reason: "PACKAGE_SLOT_NOT_FOUND" });
	}

	if (slot.bookingId && !slot.cancelledAt) {
		const booking = await ctx.db.get(slot.bookingId);
		if (
			booking &&
			booking.status !== "cancelled" &&
			isPackageSessionLocked(booking.sessionStartAt, leadTimeMinutes, now)
		) {
			return err({ reason: "PACKAGE_SLOT_LOCKED" });
		}
	}

	return ok({ multiBooking, slot });
}

async function buildPackageSessionViews(ctx: QueryCtx, multiBooking: Doc<"multiBookingPackages">) {
	const sessions: PackageSessionView[] = [];

	for (const session of multiBooking.sessions) {
		const booking = session.bookingId ? await ctx.db.get(session.bookingId) : null;
		sessions.push({
			booking: booking
				? {
						date: booking.date,
						...(booking.googleCalendarId ? { googleCalendarId: booking.googleCalendarId } : {}),
						...(booking.googleEventId ? { googleEventId: booking.googleEventId } : {}),
						sessionStartAt: booking.sessionStartAt,
						time: booking.time
					}
				: null,
			cancelledAt: session.cancelledAt,
			scheduledAt: session.scheduledAt,
			slotNumber: session.slotNumber
		});
	}

	return sessions;
}
