import { err, ok, ResultAsync } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import { hashRescheduleTokenAsync } from "#convex/sessions/lib/sessionRescheduleLinks";
import type {
	SessionAvailabilitySettings,
	SessionAvailabilityValidationError
} from "#convex/sessions/lib/sessionCalendarTime";
import { checkSessionMeetsAvailabilitySettings } from "#convex/sessions/lib/sessionCalendarTime";
import type { GoogleCalendarWriteError } from "#convex/googleCalendar/lib/googleCalendarErrors";
import type { BookingSubmitRateLimitError } from "#convex/shared/lib/rateLimits";
import type { SessionCalendarEventRecord } from "#convex/sessions/lib/sessionCalendarEventPayload";
import { getPackageSessionAddons, isDurationOption } from "#/domain/booking/catalog";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import type { BookingService } from "#/domain/booking/catalog";
import { getPackageExpiresAt } from "#/domain/booking/pricing";
import { type PackageSize } from "#/domain/booking/price-constants";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx, MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import {
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/packages/lib/packageLookup";
import {
	capacityConsumingSessionStatuses,
	sessionConsumesPackageCapacity
} from "#convex/packages/lib/packageSessionCapacity";
import { generateRescheduleToken } from "#convex/sessions/lib/sessionRescheduleLinks";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";

export { sessionConsumesPackageCapacity } from "#convex/packages/lib/packageSessionCapacity";

export function rejectMissingCapacityConsumingPackageSession(session: Doc<"bookings"> | null) {
	if (!session || !sessionConsumesPackageCapacity(session)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	return ok(session);
}

export function rejectLockedEditablePackageSession(
	now: number,
	details: {
		packageRecord: ValidPackage;
		session: Doc<"bookings">;
		settings: SessionAvailabilitySettings;
	}
) {
	if (
		isPackageSessionLocked(details.session.sessionStartAt, details.settings.leadTimeMinutes, now)
	) {
		return err({ reason: "PACKAGE_BOOKING_LOCKED" as const });
	}

	return ok(details);
}

export function rejectWhenPackageCapacityFull(
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings,
	bookings: Doc<"bookings">[]
) {
	if (bookings.length >= packageRecord.packageSize) {
		return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
	}

	return ok({ packageRecord, settings });
}

export type { ValidPackage, ValidPackageByTokenError } from "#convex/packages/lib/packageLookup";

type PackageAdminUpdateValues = { expiresAt?: number };

export type PackageScheduleToken = { scheduleTokenHash: string; token: string };

export type PackageSchedulingDetails = PackageScheduleToken & {
	expiresAt: number;
	packageFromDb: Doc<"packages">;
};

export function createPackageScheduleToken(): ResultAsync<PackageScheduleToken, never> {
	const token = generateRescheduleToken();

	return hashRescheduleTokenAsync(token).map((scheduleTokenHash) => ({ scheduleTokenHash, token }));
}

export function createPackageSchedulingDetails(
	packageFromDb: Doc<"packages">,
	paidAt: number
): ResultAsync<PackageSchedulingDetails, never> {
	return createPackageScheduleToken().map((scheduleToken) => ({
		...scheduleToken,
		expiresAt: getPackageExpiresAt(paidAt, packageFromDb.packageSize),
		packageFromDb
	}));
}

export function validatePackageScheduleTokenRefresh(packageFromDb: Doc<"packages">) {
	if (packageFromDb.status !== "paid" && packageFromDb.status !== "schedule_email_failed") {
		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" as const });
	}

	if (packageFromDb.paidAt === undefined || packageFromDb.expiresAt === undefined) {
		return err({ reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" as const });
	}

	return ok({ ...packageFromDb, paidAt: packageFromDb.paidAt, expiresAt: packageFromDb.expiresAt });
}

export function getPackageUpdateValidationError(
	values: PackageAdminUpdateValues,
	bookedSessionCount: number,
	packageSize: PackageSize
) {
	if (packageSize < bookedSessionCount) {
		return "PACKAGE_SIZE_BELOW_BOOKED_SESSIONS" as const;
	}

	if (values.expiresAt !== undefined && !Number.isFinite(values.expiresAt)) {
		return "PACKAGE_INVALID_EXPIRY" as const;
	}

	return null;
}

export type PackageSessionEditError =
	| { reason: "PACKAGE_BOOKING_NOT_FOUND" }
	| { reason: "PACKAGE_BOOKING_LOCKED" };

export type CreatePackageSessionError =
	| ValidPackageByTokenError
	| { reason: "PACKAGE_CAPACITY_EXCEEDED" }
	| SessionAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError;

export type ReschedulePackageSessionError =
	| ValidPackageByTokenError
	| PackageSessionEditError
	| SessionAvailabilityValidationError
	| { reason: "BOOKING_NOT_FOUND" }
	| BookingSubmitRateLimitError
	| GoogleCalendarWriteError;

export type UnschedulePackageSessionError =
	| ValidPackageByTokenError
	| PackageSessionEditError
	| GoogleCalendarWriteError;

export function getCapacityConsumingPackageSessions(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">,
	packageSize: 4 | 8 | 12
): ResultAsync<Doc<"bookings">[], never> {
	return ResultAsync.combine(
		capacityConsumingSessionStatuses.map((status) =>
			okOrThrow(
				ctx.db
					.query("bookings")
					.withIndex("by_packageId_and_status_and_sessionStartAt", (q) =>
						q.eq("packageId", packageId).eq("status", status)
					)
					.take(packageSize)
			)
		)
	).map((bookingsByStatus) => {
		const bookings: Doc<"bookings">[] = [];

		for (const statusBookings of bookingsByStatus) {
			bookings.push(...statusBookings);
		}

		return bookings.toSorted((a, b) => a.sessionStartAt - b.sessionStartAt);
	});
}

export function getPackageSessionForToken(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">,
	bookingId: Id<"bookings">
): ResultAsync<Doc<"bookings"> | null, never> {
	return okOrThrow(ctx.db.get("bookings", bookingId)).map((session) => {
		if (!session || session.packageId !== packageId) {
			return null;
		}

		return session;
	});
}

export function checkPackageSessionAvailability(
	args: { date: string; time: string },
	packageRecord: ValidPackage,
	settings: SessionAvailabilitySettings,
	now: number
) {
	return checkSessionMeetsAvailabilitySettings({
		date: args.date,
		duration: packageRecord.duration,
		latestBookableDate: new Date(packageRecord.expiresAt),
		now,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	});
}

export function toPackageCalendarSession(session: Doc<"bookings">): SessionCalendarEventRecord {
	const record: SessionCalendarEventRecord = {
		date: session.date,
		duration: session.duration,
		email: session.email,
		name: session.name,
		time: session.time
	};

	if (session.googleCalendarId) {
		record.googleCalendarId = session.googleCalendarId;
	}

	if (session.googleEventId) {
		record.googleEventId = session.googleEventId;
	}

	return record;
}

export function toPackageCalendarDetails(
	args: { date: string; time: string; service: BookingService; remotePodcast: boolean },
	packageRecord: ValidPackage,
	eventBufferMinutes: number
) {
	if (!isDurationOption(packageRecord.duration)) {
		throw new Error("Package duration is invalid");
	}

	return {
		addons: getPackageSessionAddons(packageRecord.addons, args.remotePodcast),
		date: args.date,
		duration: packageRecord.duration,
		email: packageRecord.email,
		eventBufferMinutes,
		name: packageRecord.name,
		service: args.service,
		time: args.time,
		...pickBookingAddonQuantities(packageRecord)
	};
}
