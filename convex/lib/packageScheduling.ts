import { err, ok, type ResultAsync } from "neverthrow";
import { okOrThrow } from "#convex/lib/result";
import type {
	SessionAvailabilitySettings,
	SessionAvailabilityValidationError
} from "./sessionCalendarTime";
import { checkSessionMeetsAvailabilitySettings } from "./sessionCalendarTime";
import type { GoogleCalendarWriteError } from "./googleCalendarErrors";
import type { BookingSubmitRateLimitError } from "./rateLimits";
import type { SessionCalendarEventRecord } from "./sessionCalendarEvents";
import {
	getPackageSessionAddons,
	isDurationOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	getMultiBookingExpiresAt,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { QueryCtx, MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import {
	getValidPackageByToken as getValidPackageByTokenResult,
	type ValidPackage,
	type ValidPackageByTokenError
} from "./packageLookup";
import { generateRescheduleToken, hashRescheduleToken } from "./sessionRescheduleLinks";

export type { ValidPackage, ValidPackageByTokenError } from "./packageLookup";

type PackageAdminUpdateValues = { expiresAt?: number; totalDueAmount?: number };

export async function createPackageScheduleToken() {
	const token = generateRescheduleToken();
	const scheduleTokenHash = await hashRescheduleToken(token);

	return { scheduleTokenHash, token };
}

export async function createPackageSchedulingDetails(
	packageFromDb: Doc<"multiBookingPackages">,
	paidAt: number
) {
	const scheduleToken = await createPackageScheduleToken();

	return {
		...scheduleToken,
		expiresAt: getMultiBookingExpiresAt(paidAt, packageFromDb.packageSize),
		packageFromDb
	};
}

export function validatePackageScheduleTokenRefresh(packageFromDb: Doc<"multiBookingPackages">) {
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

type EditablePackageSessionDetails = {
	multiBooking: ValidPackage;
	session: Doc<"bookings">;
	settings: SessionAvailabilitySettings;
};

export function getEditablePackageSession(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
): ResultAsync<EditablePackageSessionDetails, ValidPackageByTokenError | PackageSessionEditError> {
	return (
		getValidPackageByTokenResult(ctx, args.token, args.now)
			// Load the requested session through the package to enforce ownership.
			.andThen((multiBooking) =>
				okOrThrow(getPackageSessionForToken(ctx, multiBooking._id, args.bookingId)).map(
					(session) => ({ multiBooking, session })
				)
			)
			// Reject missing, foreign, and inactive sessions before loading scheduling settings.
			.andThen(({ multiBooking, session }) => {
				if (!session || !sessionConsumesPackageCapacity(session)) {
					return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
				}

				return okOrThrow<SessionAvailabilitySettings>(
					ctx.runQuery(api.bookingSettings.get, {})
				).map((settings) => ({ multiBooking, session, settings }));
			})
			// Enforce the edit cutoff after the session and settings are available.
			.andThen((details) => {
				if (
					isPackageSessionLocked(
						details.session.sessionStartAt,
						details.settings.leadTimeMinutes,
						args.now
					)
				) {
					return err({ reason: "PACKAGE_BOOKING_LOCKED" as const });
				}

				return ok(details);
			})
	);
}
