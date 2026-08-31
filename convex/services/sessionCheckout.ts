import { err, ok, type ResultAsync } from "neverthrow";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "#studio/lib/bookingAvailabilitySettings";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { getOrCreateDriveClientId } from "#convex/lib/driveRecords";
import { okOrThrow } from "#convex/lib/result";
import { getSessionStartAt } from "#convex/lib/sessionAdminEdit";
import {
	checkSessionMeetsAvailabilitySettings,
	type SessionAvailabilityValidationError
} from "#convex/lib/sessionCalendarTime";
import {
	validatePendingSessionDeletion,
	validateSessionExpiry,
	type DeletePendingSessionSuccess
} from "#convex/lib/sessionCheckout";

export type CreatePendingSessionArgs = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: string[];
	notes?: string;
} & BookingAddonQuantitiesArgs;

export function createPendingSessionService(
	ctx: MutationCtx,
	args: CreatePendingSessionArgs
): ResultAsync<{ bookingId: Doc<"bookings">["_id"] }, SessionAvailabilityValidationError> {
	return (
		okOrThrow(
			ctx.db
				.query("bookingSettings")
				.withIndex("by_key", (indexQuery) => indexQuery.eq("key", "main"))
				.unique()
		)
			.map((settings) => settings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS)
			// Validate the requested slot against the current booking settings.
			.andThen((settings) =>
				checkSessionMeetsAvailabilitySettings({
					date: args.date,
					duration: args.duration,
					settings,
					time: args.time,
					timeZone: env.GOOGLE_CALENDAR_TIMEZONE
				})
			)
			// Convert the validated local date and time to the stored timestamp.
			.andThen(() => getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE))
			// Check and insert in one transaction so concurrent checkouts cannot claim the same time.
			.andThen((sessionStartAt) =>
				okOrThrow(
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
					}).andThen((driveClientId) =>
						okOrThrow(
							ctx.db.insert("bookings", {
								...args,
								email: args.email.trim().toLowerCase(),
								sessionStartAt,
								status: "pending_payment",
								pendingPaymentCreatedAt: Date.now(),
								driveClientId
							})
						).map((bookingId) => ({ bookingId }))
					);
				})
			)
	);
}

export function markSessionExpiredByStripeSessionIdService(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	return (
		okOrThrow(
			ctx.db
				.query("bookings")
				.withIndex("by_stripeSessionId", (indexQuery) =>
					indexQuery.eq("stripeSessionId", args.stripeSessionId)
				)
				.unique()
		)
			// Confirm that the booking can transition to expired.
			.andThen(validateSessionExpiry)
			// Preserve idempotency or apply the expiry transition.
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<{ alreadyExpired: boolean }>({ alreadyExpired: decision.alreadyExpired });
				}

				return okOrThrow(
					ctx.db
						.patch(decision.bookingId, { status: "expired" })
						.then(() => ({ alreadyExpired: false }))
				);
			})
	);
}

export function deletePendingSessionService(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"]; stripeSessionId: string }
) {
	return (
		okOrThrow(ctx.db.get(args.bookingId))
			// Verify ownership and whether the pending booking still needs abandonment.
			.andThen((booking) => validatePendingSessionDeletion(booking, args.stripeSessionId))
			// Return terminal outcomes unchanged or abandon the pending booking.
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<DeletePendingSessionSuccess>(decision.value);
				}

				return okOrThrow(
					ctx.db
						.patch(args.bookingId, { status: "abandoned" })
						.then((): DeletePendingSessionSuccess => ({ outcome: "abandoned" }))
				);
			})
	);
}
