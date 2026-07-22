import { err, ok, type Result } from "../../src/lib/result";
import type {
	BookingAvailabilitySettings,
	BookingAvailabilityValidationError
} from "./bookingCalendarTime";
import { checkBookingMeetsAvailabilitySettings } from "./bookingCalendarTime";
import type { GoogleCalendarWriteError } from "./googleCalendarErrors";
import type { BookingSubmitRateLimitError } from "./rateLimits";
import { hashRescheduleToken } from "./bookingRescheduleLinks";
import type { BookingCalendarEventRecord } from "./googleCalendarEvents";
import { getBookingSessionStartAt } from "./bookingAdminEdit";
import {
	getPackageSessionAddons,
	isDurationOption
} from "../../src/sites/studio/features/booking-form/lib/booking-form-model";
import type { MultiBookingSize } from "../../src/sites/studio/features/booking-form/lib/booking-pricing";
import { isPackageSessionLocked } from "../../src/sites/studio/features/booking-form/lib/package-scheduling-rules";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { env } from "../env";

type PackageAdminUpdateValues = { expiresAt?: number; totalDueAmount?: number };

export function getPackageAdminUpdateValidationError(
	values: PackageAdminUpdateValues,
	bookedSessionCount: number,
	packageSize: MultiBookingSize
) {
	if (packageSize < bookedSessionCount) {
		return "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" as const;
	}

	if (values.expiresAt !== undefined && !Number.isFinite(values.expiresAt)) {
		return "PACKAGE_INVALID_EXPIRY" as const;
	}

	if (
		values.totalDueAmount !== undefined &&
		(!Number.isFinite(values.totalDueAmount) || values.totalDueAmount < 0)
	) {
		return "PACKAGE_INVALID_TOTAL_DUE_AMOUNT" as const;
	}

	return null;
}

export type ValidPackageByTokenError =
	| { reason: "PACKAGE_LINK_INVALID" }
	| { reason: "PACKAGE_LINK_EXPIRED" }
	| { reason: "PACKAGE_LINK_INACTIVE" }
	| { reason: "PACKAGE_NOT_PAID" };

export type PackageBookingEditError =
	| { reason: "PACKAGE_BOOKING_NOT_FOUND" }
	| { reason: "PACKAGE_BOOKING_LOCKED" };

export type CreatePackageBookingError =
	| ValidPackageByTokenError
	| { reason: "PACKAGE_CAPACITY_EXCEEDED" }
	| BookingAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_SAVE_FAILED" };

export type ReschedulePackageBookingError =
	| ValidPackageByTokenError
	| PackageBookingEditError
	| BookingAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_SAVE_FAILED" };

export type UnschedulePackageBookingError =
	| ValidPackageByTokenError
	| PackageBookingEditError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_CANCEL_FAILED" };

export type ValidPackage = Doc<"multiBookingPackages"> & { expiresAt: number };

const capacityConsumingBookingStatuses = ["confirmed", "email_failed"] as const;

export function bookingConsumesPackageCapacity(booking: Pick<Doc<"bookings">, "status">) {
	switch (booking.status) {
		case "confirmed":
		case "email_failed":
			return true;
		case "cancelled":
		case "pending_payment":
		case "failed":
		case "expired":
		case "abandoned":
			return false;
		default: {
			const _exhaustive: never = booking.status;
			return _exhaustive;
		}
	}
}

export async function getCapacityConsumingPackageBookings(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"multiBookingPackages">,
	packageSize: 4 | 8 | 12
) {
	const bookings: Doc<"bookings">[] = [];
	for (const status of capacityConsumingBookingStatuses) {
		const statusBookings = await ctx.db
			.query("bookings")
			.withIndex("by_multiBookingPackageId_and_status_and_sessionStartAt", (q) =>
				q.eq("multiBookingPackageId", packageId).eq("status", status)
			)
			.take(packageSize);
		bookings.push(...statusBookings);
	}
	return bookings.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
}

export async function getPackageBookingForToken(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"multiBookingPackages">,
	bookingId: Id<"bookings">
) {
	const booking = await ctx.db.get(bookingId);

	if (!booking || booking.multiBookingPackageId !== packageId) {
		return null;
	}

	return booking;
}

export function checkPackageBookingAvailability(
	args: { date: string; time: string },
	multiBooking: ValidPackage,
	settings: BookingAvailabilitySettings,
	now: number
) {
	return checkBookingMeetsAvailabilitySettings({
		date: args.date,
		duration: multiBooking.duration,
		latestBookableDate: new Date(multiBooking.expiresAt),
		now,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	});
}

export function toPackageCalendarBooking(booking: Doc<"bookings">): BookingCalendarEventRecord {
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

export function toPackageCalendarDetails(
	args: {
		date: string;
		time: string;
		service: "Table Setup" | "Armchair Setup";
		remotePodcast: boolean;
	},
	multiBooking: ValidPackage,
	eventBufferMinutes: number
) {
	if (!isDurationOption(multiBooking.duration)) {
		throw new Error("Package duration is invalid");
	}

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

export function getPackageSessionStartAt(args: { date: string; time: string }) {
	return getBookingSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE);
}

export async function getEditablePackageBooking(
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

export async function getValidPackageByToken(
	ctx: QueryCtx | MutationCtx,
	token: string,
	now: number
): Promise<Result<ValidPackage, ValidPackageByTokenError>> {
	const scheduleTokenHash = await hashRescheduleToken(token);
	const multiBooking = await ctx.db
		.query("multiBookingPackages")
		.withIndex("by_scheduleTokenHash", (query) => query.eq("scheduleTokenHash", scheduleTokenHash))
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
