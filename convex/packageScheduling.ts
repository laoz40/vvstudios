import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { hashRescheduleToken } from "./lib/bookingRescheduleLinks";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalQuery,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import { checkBookingMeetsAvailabilitySettings } from "./lib/bookingCalendarTime";
import { env } from "./env";
import { api } from "./_generated/api";
import { getBookingSessionStartAt } from "./lib/bookingAdminEdit";
import { getTimeZoneDateKey } from "../src/sites/studio/lib/zonedDateTime";

const PACKAGE_SLOT_EDIT_LOCK_MS = 24 * 60 * 60 * 1000;

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
	booking: null | { date: string; sessionStartAt: number; time: string };
	cancelledAt?: number;
	scheduledAt?: number;
	slotNumber: number;
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

export const savePackageSlot = mutation({
	args: { token: v.string(), slotNumber: v.number(), date: v.string(), time: v.string() },
	handler: (ctx, args) => savePackageSlotHandler(ctx, args)
});

async function savePackageSlotHandler(
	ctx: MutationCtx,
	args: { date: string; slotNumber: number; time: string; token: string }
): Promise<
	Result<
		{ bookingId: Id<"bookings">; slotNumber: number },
		| PackageSlotLookupError
		| { reason: "BOOKING_INVALID_DATE" }
		| { reason: "BOOKING_INVALID_DURATION" }
		| { reason: "BOOKING_INVALID_TIME" }
		| { reason: "BOOKING_OUTSIDE_OPENING_HOURS" }
		| { reason: "BOOKING_TOO_FAR_AHEAD" }
		| { reason: "BOOKING_TOO_SOON" }
		| { reason: "PACKAGE_SLOT_SAVE_FAILED" }
	>
> {
	const now = Date.now();
	const [lookupError, lookup] = await getEditablePackageSlot(ctx, args.token, args.slotNumber, now);

	if (lookupError !== null) {
		return err(lookupError);
	}

	const settings = await ctx.runQuery(api.bookingSettings.get, {});
	const [availabilityError] = checkBookingMeetsAvailabilitySettings({
		date: args.date,
		duration: lookup.multiBooking.duration,
		latestBookableDate: new Date(
			`${getTimeZoneDateKey(new Date(lookup.multiBooking.expiresAt), env.GOOGLE_CALENDAR_TIMEZONE)}T00:00:00`
		),
		now,
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

	// Save the selected package slot as a normal booking row.
	// If the slot was empty, create the booking. If it already had a booking, update its time.
	try {
		const bookingId = lookup.slot.bookingId
			? lookup.slot.bookingId
			: await ctx.db.insert("bookings", {
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
					bookingConfirmedAt: now,
					multiBookingPackageId: lookup.multiBooking._id,
					multiBookingSlotNumber: args.slotNumber
				});

		// Existing slot booking: move it to the newly selected date/time and reset reminder state.
		if (lookup.slot.bookingId) {
			await ctx.db.patch(lookup.slot.bookingId, {
				date: args.date,
				time: args.time,
				sessionStartAt,
				reminderEmailClaimedAt: undefined,
				reminderEmailSentAt: undefined,
				reminderEmailFailureCode: undefined
			});
		}

		// Link booking id to this package session
		await ctx.db.patch(lookup.multiBooking._id, {
			sessions: lookup.multiBooking.sessions.map((session) =>
				session.slotNumber === args.slotNumber
					? { bookingId, scheduledAt: now, slotNumber: session.slotNumber }
					: session
			)
		});

		return ok({ bookingId, slotNumber: args.slotNumber });
	} catch {
		return err({ reason: "PACKAGE_SLOT_SAVE_FAILED" });
	}
}

export type SavePackageSlotResult = Awaited<ReturnType<typeof savePackageSlotHandler>>;

export const clearPackageSlot = mutation({
	args: { token: v.string(), slotNumber: v.number() },
	handler: (ctx, args) => clearPackageSlotHandler(ctx, args)
});

async function clearPackageSlotHandler(
	ctx: MutationCtx,
	args: { slotNumber: number; token: string }
): Promise<
	Result<
		{ cleared: true; slotNumber: number },
		PackageSlotLookupError | { reason: "PACKAGE_SLOT_CLEAR_FAILED" }
	>
> {
	const now = Date.now();
	const [lookupError, lookup] = await getEditablePackageSlot(ctx, args.token, args.slotNumber, now);

	if (lookupError !== null) {
		return err(lookupError);
	}

	try {
		await ctx.db.patch(lookup.multiBooking._id, {
			sessions: lookup.multiBooking.sessions.map((session) =>
				session.slotNumber === args.slotNumber
					? { bookingId: session.bookingId, cancelledAt: now, slotNumber: session.slotNumber }
					: session
			)
		});

		return ok({ cleared: true, slotNumber: args.slotNumber });
	} catch {
		return err({ reason: "PACKAGE_SLOT_CLEAR_FAILED" });
	}
}

export type ClearPackageSlotResult = Awaited<ReturnType<typeof clearPackageSlotHandler>>;

export const getValidPackageByTokenInternal = internalQuery({
	args: { now: v.number(), token: v.string() },
	handler: async (ctx, args) => getValidPackageByToken(ctx, args.token, args.now)
});

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
	ctx: MutationCtx,
	token: string,
	slotNumber: number,
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

	if (slot.bookingId) {
		const booking = await ctx.db.get(slot.bookingId);
		if (booking && booking.sessionStartAt - now < PACKAGE_SLOT_EDIT_LOCK_MS) {
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
				? { date: booking.date, sessionStartAt: booking.sessionStartAt, time: booking.time }
				: null,
			cancelledAt: session.cancelledAt,
			scheduledAt: session.scheduledAt,
			slotNumber: session.slotNumber
		});
	}

	return sessions;
}
