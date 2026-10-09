import { err, ok, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import type { BookingAddon } from "#/domain/booking/catalog";
import { buildBookingSearchBlob } from "#convex/lib/adminSearch/adminSearchBlob";
import { normalizePhone } from "#convex/lib/contactNormalization";
import { okOrThrow } from "#convex/lib/result";
import {
	checkSessionMeetsAvailabilitySettings,
	type SessionAvailabilityValidationError
} from "#convex/lib/sessions/sessionCalendarTime";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

export type CreatePendingCheckoutSessionArgs = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: BookingAddon[];
	notes?: string;
} & BookingAddonQuantitiesArgs;

export function validateCheckoutSessionAvailability(
	settings: BookingAvailabilitySettings,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
): Result<null, SessionAvailabilityValidationError> {
	return checkSessionMeetsAvailabilitySettings({
		date: args.date,
		duration: args.duration,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	}).map(() => null);
}

export function findPendingPaymentBookingAtStartTime(
	ctx: MutationCtx,
	sessionStartAt: number
): ResultAsync<Doc<"bookings"> | null, never> {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_status_and_sessionStartAt", (query) =>
				query.eq("status", "pending_payment").eq("sessionStartAt", sessionStartAt)
			)
			.first()
	);
}

export type PendingPaymentBookingInsertFields = CreatePendingCheckoutSessionArgs & {
	phone: string;
	email: string;
	sessionStartAt: number;
	status: "pending_payment";
	pendingPaymentCreatedAt: number;
	archived: false;
	driveClientId: Id<"driveClients">;
};

export function buildPendingPaymentBookingFields(
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number,
	driveClientId: Id<"driveClients">
): PendingPaymentBookingInsertFields {
	const email = args.email.trim().toLowerCase();
	const phone = normalizePhone(args.phone);

	return {
		...args,
		phone,
		email,
		sessionStartAt,
		status: "pending_payment",
		pendingPaymentCreatedAt: Date.now(),
		archived: false,
		driveClientId
	};
}

export function insertPendingPaymentBooking(
	ctx: MutationCtx,
	bookingFields: PendingPaymentBookingInsertFields
): ResultAsync<{ bookingId: Doc<"bookings">["_id"] }, never> {
	return okOrThrow(
		ctx.db.insert("bookings", {
			...bookingFields,
			searchBlob: buildBookingSearchBlob(bookingFields)
		})
	).map((bookingId) => ({ bookingId }));
}

export function rejectPendingPaymentSlotConflict(
	pendingBooking: Doc<"bookings"> | null
): Result<null, SessionAvailabilityValidationError> {
	if (pendingBooking !== null) {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
	}

	return ok(null);
}
