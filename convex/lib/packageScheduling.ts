import { err, ok, type Result } from "../../src/lib/result";
import type {
	SessionAvailabilitySettings,
	SessionAvailabilityValidationError
} from "./sessionCalendarTime";
import { checkSessionMeetsAvailabilitySettings } from "./sessionCalendarTime";
import type { GoogleCalendarWriteError } from "./googleCalendarErrors";
import type { BookingSubmitRateLimitError } from "./rateLimits";
import { hashRescheduleToken } from "./sessionRescheduleLinks";
import type { SessionCalendarEventRecord } from "./sessionCalendarEvents";
import { getSessionStartAt } from "./sessionAdminEdit";
import {
	getPackageSessionAddons,
	isDurationOption,
	type BookingFormValues
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

export type PackageSessionEditError =
	| { reason: "PACKAGE_BOOKING_NOT_FOUND" }
	| { reason: "PACKAGE_BOOKING_LOCKED" };

export type CreatePackageSessionError =
	| ValidPackageByTokenError
	| { reason: "PACKAGE_CAPACITY_EXCEEDED" }
	| SessionAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_SAVE_FAILED" };

export type ReschedulePackageSessionError =
	| ValidPackageByTokenError
	| PackageSessionEditError
	| SessionAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_SAVE_FAILED" };

export type UnschedulePackageSessionError =
	| ValidPackageByTokenError
	| PackageSessionEditError
	| GoogleCalendarWriteError
	| { reason: "PACKAGE_BOOKING_CANCEL_FAILED" };

export type ValidPackage = Doc<"multiBookingPackages"> & { expiresAt: number };

const capacityConsumingSessionStatuses = ["confirmed", "email_failed"] as const;

export function sessionConsumesPackageCapacity(session: Pick<Doc<"bookings">, "status">) {
	switch (session.status) {
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
			const _exhaustive: never = session.status;
			return _exhaustive;
		}
	}
}

export async function getCapacityConsumingPackageSessions(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"multiBookingPackages">,
	packageSize: 4 | 8 | 12
) {
	const bookings: Doc<"bookings">[] = [];
	for (const status of capacityConsumingSessionStatuses) {
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

export async function getPackageSessionForToken(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"multiBookingPackages">,
	bookingId: Id<"bookings">
) {
	const session = await ctx.db.get(bookingId);

	if (!session || session.multiBookingPackageId !== packageId) {
		return null;
	}

	return session;
}

export function checkPackageSessionAvailability(
	args: { date: string; time: string },
	multiBooking: ValidPackage,
	settings: SessionAvailabilitySettings,
	now: number
) {
	return checkSessionMeetsAvailabilitySettings({
		date: args.date,
		duration: multiBooking.duration,
		latestBookableDate: new Date(multiBooking.expiresAt),
		now,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	});
}

export function toPackageCalendarSession(session: Doc<"bookings">): SessionCalendarEventRecord {
	return {
		date: session.date,
		duration: session.duration,
		email: session.email,
		name: session.name,
		time: session.time,
		...(session.googleCalendarId ? { googleCalendarId: session.googleCalendarId } : {}),
		...(session.googleEventId ? { googleEventId: session.googleEventId } : {})
	};
}

export function toPackageCalendarDetails(
	args: {
		date: string;
		time: string;
		service: Exclude<BookingFormValues["service"], "">;
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
	return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE);
}

export async function getEditablePackageSession(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
) {
	const [error, multiBooking] = await getValidPackageByToken(ctx, args.token, args.now);

	if (error !== null) {
		return err(error);
	}

	const session = await getPackageSessionForToken(ctx, multiBooking._id, args.bookingId);

	if (!session || !sessionConsumesPackageCapacity(session)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	const settings: SessionAvailabilitySettings = await ctx.runQuery(api.bookingSettings.get, {});

	if (isPackageSessionLocked(session.sessionStartAt, settings.leadTimeMinutes, args.now)) {
		return err({ reason: "PACKAGE_BOOKING_LOCKED" as const });
	}

	return ok({ session, multiBooking, settings });
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
