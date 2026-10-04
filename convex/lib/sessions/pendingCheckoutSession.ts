import { err, type Result, type ResultAsync } from "neverthrow";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { buildBookingSearchBlob } from "#convex/lib/adminSearch/adminSearchBlob";
import { getOrCreateDriveClientId } from "#convex/lib/drive/driveFolders";
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

export function insertPendingCheckoutBooking(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number
): ResultAsync<{ bookingId: Doc<"bookings">["_id"] }, SessionAvailabilityValidationError> {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_status_and_sessionStartAt", (query) =>
				query.eq("status", "pending_payment").eq("sessionStartAt", sessionStartAt)
			)
			.first()
	).andThen((pendingBooking) => {
		if (pendingBooking !== null) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
		}

		return getOrCreateDriveClientId(ctx, {
			email: args.email,
			displayName: formatDriveClientFolderName({
				accountName: args.accountName,
				contactName: args.name
			})
		}).andThen((driveClientId) => {
			const email = args.email.trim().toLowerCase();

			const phone = normalizePhone(args.phone);

			const bookingFields = {
				...args,
				phone,
				email,
				sessionStartAt,
				status: "pending_payment" as const,
				pendingPaymentCreatedAt: Date.now(),
				archived: false,
				driveClientId
			};

			return okOrThrow(
				ctx.db.insert("bookings", {
					...bookingFields,
					searchBlob: buildBookingSearchBlob(bookingFields)
				})
			).map((bookingId) => ({ bookingId }));
		});
	});
}
