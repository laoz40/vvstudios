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
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { env } from "../env";

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
	return bookings.sort((a, b) => a.sessionStartAt - b.sessionStartAt);
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
