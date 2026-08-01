import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import {
	getCapacityConsumingPackageSessions,
	getPackageSessionForToken,
	getPackageSessionStartAt,
	sessionConsumesPackageCapacity,
	toPackageCalendarDetails,
	toPackageCalendarSession,
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "#convex/lib/packageScheduling";
import { getValidPackageByToken } from "#convex/lib/packageLookup";
import { fromConvexResult, okOrThrow } from "#convex/lib/result";
import { getPackageSessionAddons } from "#studio/features/booking-form/lib/booking-form-model";

type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: "Table Setup" | "Armchair Setup";
	notes?: string;
	remotePodcast: boolean;
};

type ReschedulePackageSessionArgs = PackageSessionArgs & { bookingId: Id<"bookings"> };
type UnschedulePackageSessionArgs = { bookingId: Id<"bookings">; token: string };

export function createPackageSessionService(
	ctx: ActionCtx,
	args: PackageSessionArgs
): ResultAsync<{ bookingId: Id<"bookings"> }, CreatePackageSessionError> {
	const now = Date.now();

	return (
		fromConvexResult(
			ctx.runQuery(internal.packageScheduling.validatePackageSessionRequest, {
				token: args.token,
				date: args.date,
				time: args.time,
				now
			})
		)
			// Apply the package-scoped submit limit before creating an external Calendar event.
			.andThen((details) =>
				fromConvexResult(
					ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, {
						submitRateLimitKey: `package:${details.multiBooking._id}`
					})
				).map(() => details)
			)
			// Create the Calendar event before persisting its identifiers with the booking.
			.andThen((details) =>
				fromConvexResult(
					ctx.runAction(internal.packageSchedulingCalendar.createPackageSessionCalendarEvent, {
						session: null,
						details: toPackageCalendarDetails(
							args,
							details.multiBooking,
							details.eventBufferMinutes
						)
					})
				).map((calendar) => ({ calendar, details }))
			)
			// Save the booking, deleting an orphaned Calendar event if an expected save check loses a race.
			.andThen(({ calendar, details }) =>
				fromConvexResult(
					ctx.runMutation(internal.packageScheduling.saveCreatedPackageSession, {
						...args,
						now,
						...(calendar.googleCalendarId ? { googleCalendarId: calendar.googleCalendarId } : {}),
						...(calendar.googleEventId ? { googleEventId: calendar.googleEventId } : {})
					})
				).orElse((saveError) => {
					if (!calendar.googleEventId || !calendar.googleCalendarId) {
						return err(saveError);
					}

					return fromConvexResult(
						ctx.runAction(internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
							session: {
								date: args.date,
								duration: details.multiBooking.duration,
								email: details.multiBooking.email,
								googleCalendarId: calendar.googleCalendarId,
								googleEventId: calendar.googleEventId,
								name: details.multiBooking.name,
								time: args.time
							}
						})
					)
						.mapErr((cleanupError) => {
							console.error("Failed to compensate orphan package Calendar event", cleanupError);
							return saveError;
						})
						.andThen(() => err(saveError));
				})
			)
	);
}

export function reschedulePackageSessionService(
	ctx: ActionCtx,
	args: ReschedulePackageSessionArgs
): ResultAsync<{ bookingId: Id<"bookings"> }, ReschedulePackageSessionError> {
	const now = Date.now();

	return (
		fromConvexResult(
			ctx.runQuery(internal.packageScheduling.validatePackageRescheduleRequest, {
				token: args.token,
				bookingId: args.bookingId,
				date: args.date,
				time: args.time,
				now
			})
		)
			// Reserve the requested time before updating the external Calendar event.
			.andThen((details) =>
				fromConvexResult(
					ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
						bookingId: args.bookingId,
						duration: details.multiBooking.duration,
						eventBufferMinutes: details.eventBufferMinutes,
						now: Date.now(),
						sessionStartAt: details.sessionStartAt
					})
				).andThen((reservationResult) => {
					return reservationResult.outcome === "unavailable"
						? err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
						: ok({ details, reservation: reservationResult.reservation });
				})
			)
			// Update Calendar while holding the reservation; release it on an expected provider failure.
			.andThen(({ details, reservation }) =>
				fromConvexResult(
					ctx.runAction(internal.packageSchedulingCalendar.updatePackageSessionCalendarEvent, {
						session: toPackageCalendarSession(details.session),
						details: toPackageCalendarDetails(
							args,
							details.multiBooking,
							details.eventBufferMinutes
						)
					})
				)
					.map((calendar) => ({ calendar, details, reservation }))
					.orElse((calendarError) =>
						clearPackageSessionReservation(ctx, args.bookingId, reservation).andThen(() =>
							err(calendarError)
						)
					)
			)
			// Persist the new booking details and release the reservation if the save is rejected.
			.andThen(({ calendar, details, reservation }) =>
				fromConvexResult(
					ctx.runMutation(internal.sessionScheduling.saveClientSessionReschedule, {
						bookingId: args.bookingId,
						date: args.date,
						time: args.time,
						service: args.service,
						notes: args.notes,
						addons: getPackageSessionAddons(details.multiBooking.addons, args.remotePodcast),
						sessionStartAt: details.sessionStartAt,
						googleCalendarId: calendar.googleCalendarId,
						googleEventId: calendar.googleEventId,
						multiBookingPackageId: details.multiBooking._id,
						reservation
					})
				)
					.map(() => ({ bookingId: args.bookingId }))
					.orElse((saveError) =>
						clearPackageSessionReservation(ctx, args.bookingId, reservation).andThen(() =>
							err(saveError)
						)
					)
			)
	);
}

export function unschedulePackageSessionService(
	ctx: ActionCtx,
	args: UnschedulePackageSessionArgs
): ResultAsync<{ cancelled: true; bookingId: Id<"bookings"> }, UnschedulePackageSessionError> {
	const now = Date.now();

	return (
		fromConvexResult(
			ctx.runQuery(internal.packageScheduling.validatePackageUnscheduleRequest, { ...args, now })
		)
			// Delete the Calendar event before marking the booking cancelled.
			.andThen((details) =>
				fromConvexResult(
					ctx.runAction(internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
						session: toPackageCalendarSession(details.session)
					})
				).map(() => null)
			)
			// Persist cancellation only after Calendar deletion succeeds or reports the event missing.
			.andThen(() =>
				fromConvexResult(
					ctx.runMutation(internal.packageScheduling.cancelPackageSession, {
						bookingId: args.bookingId,
						now,
						token: args.token
					})
				)
			)
	);
}

function clearPackageSessionReservation(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	reservation: { reservedAt: number; sessionStartAt: number; duration: string }
) {
	return fromConvexResult(
		ctx.runMutation(internal.sessionScheduling.clearSessionReservation, { bookingId, reservation })
	).map(() => null);
}

export type SaveCreatedPackageSessionArgs = PackageSessionArgs & {
	now: number;
	googleCalendarId?: string;
	googleEventId?: string;
};

export type CancelPackageSessionArgs = { bookingId: Id<"bookings">; token: string; now: number };

export function saveCreatedPackageSessionService(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	schedulePackageAdjustment: (packageId: Id<"multiBookingPackages">) => Promise<unknown>
) {
	return (
		getValidPackageByToken(ctx, args.token, args.now)
			// Load the sessions that currently consume this package's capacity.
			.andThen((packageFromDb) =>
				okOrThrow(
					getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize)
				).map((packageSessions) => ({ packageFromDb, packageSessions }))
			)
			// Confirm the package has capacity and parse the requested session start.
			.andThen(({ packageFromDb, packageSessions }) => {
				if (packageSessions.length >= packageFromDb.packageSize) {
					return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
				}

				return getPackageSessionStartAt(args).map((sessionStartAt) => ({
					packageFromDb,
					sessionStartAt
				}));
			})
			// Save the confirmed booking with the package and session snapshots.
			.andThen(({ packageFromDb, sessionStartAt }) =>
				okOrThrow(
					ctx.db
						.insert("bookings", {
							name: packageFromDb.name,
							phone: packageFromDb.phone,
							accountName: packageFromDb.accountName,
							abn: packageFromDb.abn,
							email: packageFromDb.email,
							instagramHandle: packageFromDb.instagramHandle,
							date: args.date,
							time: args.time,
							sessionStartAt,
							duration: packageFromDb.duration,
							service: args.service,
							addons: getPackageSessionAddons(packageFromDb.addons, args.remotePodcast),
							essentialEditQuantity: packageFromDb.essentialEditQuantity,
							clipsPackageQuantity: packageFromDb.clipsPackageQuantity,
							notes: args.notes,
							status: "confirmed",
							pendingPaymentCreatedAt: packageFromDb.createdAt,
							paymentCompletedAt: packageFromDb.paidAt,
							bookingConfirmedAt: args.now,
							googleCalendarId: args.googleCalendarId,
							googleEventId: args.googleEventId,
							multiBookingPackageId: packageFromDb._id
						})
						.then((bookingId) => ({ bookingId, packageFromDb }))
				)
			)
			// Clear expiry reminder after the customer schedules another session.
			.andThen(({ bookingId, packageFromDb }) => {
				if (packageFromDb.packageReminderState?.type !== "expiry") {
					return ok({ bookingId, packageFromDb });
				}

				return okOrThrow(
					ctx.db
						.patch(packageFromDb._id, { packageReminderState: undefined })
						.then(() => ({ bookingId, packageFromDb }))
				);
			})
			// Check whether every package slot is now scheduled. Once full, adjustment processing
			// waits for the final session to end before recording whether Remote Podcast charges are due.
			.andThen(({ bookingId, packageFromDb }) =>
				okOrThrow(schedulePackageAdjustment(packageFromDb._id).then(() => ({ bookingId })))
			)
	);
}

export function cancelPackageSessionService(ctx: MutationCtx, args: CancelPackageSessionArgs) {
	return (
		getValidPackageByToken(ctx, args.token, args.now)
			// Load the session through the package to enforce ownership.
			.andThen((packageFromDb) =>
				okOrThrow(getPackageSessionForToken(ctx, packageFromDb._id, args.bookingId)).map(
					(session) => ({ packageFromDb, session })
				)
			)
			// Confirm the session exists and still consumes package capacity.
			.andThen(({ session }) => {
				if (!session || !sessionConsumesPackageCapacity(session)) {
					return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
				}

				return ok(null);
			})
			// Cancel the booking and clear its Calendar and reminder state.
			.andThen(() =>
				okOrThrow(
					ctx.db
						.patch(args.bookingId, {
							bookingFailureCode: undefined,
							googleCalendarId: undefined,
							googleEventId: undefined,
							reminderEmailClaimedAt: undefined,
							reminderEmailSentAt: undefined,
							reminderEmailFailureCode: undefined,
							status: "cancelled"
						})
						.then(() => ({ cancelled: true as const, bookingId: args.bookingId }))
				)
			)
	);
}
