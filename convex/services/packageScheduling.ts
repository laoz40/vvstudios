import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getOrCreateDriveClientId } from "#convex/lib/driveRecords";
import { getClientFolderName } from "#convex/lib/googleDrive";
import { processPackageAdjustment } from "#convex/lib/packageAdjustments";
import {
	checkPackageSessionAvailability,
	getCapacityConsumingPackageSessions,
	getEditablePackageSession,
	getPackageSessionForToken,
	sessionConsumesPackageCapacity,
	toPackageCalendarDetails,
	toPackageCalendarSession,
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "#convex/lib/packageScheduling";
import {
	getValidPackageByToken,
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/lib/packageLookup";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { getSessionStartAt } from "#convex/lib/sessionAdminEdit";
import type { SessionAvailabilitySettings } from "#convex/lib/sessionCalendarTime";
import { env } from "#convex/env";
import {
	getPackageSessionAddons,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: RecordingSpace;
	notes?: string;
	remotePodcast: boolean;
};

type ReschedulePackageSessionArgs = PackageSessionArgs & { bookingId: Id<"bookings"> };
type UnschedulePackageSessionArgs = { bookingId: Id<"bookings">; token: string };

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };
type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };
type PackageUnscheduleRequestArgs = UnschedulePackageSessionArgs & { now: number };

export type PackageSessionRequestDetails = {
	multiBooking: ValidPackage;
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	sessionStartAt: number;
};

export type PackageRescheduleRequestDetails = {
	session: Doc<"bookings">;
	multiBooking: ValidPackage;
	eventBufferMinutes: number;
	sessionStartAt: number;
};

export type PackageUnscheduleRequestDetails = {
	session: Doc<"bookings">;
	multiBooking: ValidPackage;
};

export function getPackageByTokenService(ctx: QueryCtx, token: string) {
	return getValidPackageByToken(ctx, token, Date.now())
		.andThen((multiBooking) =>
			okOrThrow(
				getCapacityConsumingPackageSessions(ctx, multiBooking._id, multiBooking.packageSize)
			).map((sessions) => ({ multiBooking, sessions }))
		)
		.map(({ multiBooking, sessions }) => ({
			_id: multiBooking._id,
			name: multiBooking.name,
			email: multiBooking.email,
			duration: multiBooking.duration,
			addons: multiBooking.addons,
			essentialEditQuantity: multiBooking.essentialEditQuantity,
			completeEditQuantity: multiBooking.completeEditQuantity,
			clipsPackageQuantity: multiBooking.clipsPackageQuantity,
			handcraftedClipsQuantity: multiBooking.handcraftedClipsQuantity,
			packageSize: multiBooking.packageSize,
			expiresAt: multiBooking.expiresAt,
			defaultSpace: multiBooking.defaultSpace,
			sessions: sessions.map((session) => ({
				_id: session._id,
				date: session.date,
				time: session.time,
				sessionStartAt: session.sessionStartAt,
				notes: session.notes ?? "",
				service: session.service,
				addons: session.addons,
				...(session.googleEventId ? { googleEventId: session.googleEventId } : {})
			}))
		}));
}

export function setPackageDefaultSpaceService(
	ctx: MutationCtx,
	args: { service: RecordingSpace; token: string }
) {
	return getValidPackageByToken(ctx, args.token, Date.now()).andThen((multiBooking) =>
		okOrThrow(
			ctx.db
				.patch(multiBooking._id, { defaultSpace: args.service })
				.then(() => ({ defaultSpace: args.service }))
		)
	);
}

export function createPackageSessionService(
	ctx: ActionCtx,
	args: PackageSessionArgs
): ResultAsync<{ bookingId: Id<"bookings"> }, CreatePackageSessionError> {
	const now = Date.now();

	return (
		fromConvexTuple(
			ctx.runQuery(internal.packageScheduling.validatePackageSessionRequest, {
				token: args.token,
				date: args.date,
				time: args.time,
				now
			})
		)
			// Apply the package-scoped submit limit before creating an external Calendar event.
			.andThen((details) =>
				fromConvexTuple(
					ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, {
						submitRateLimitKey: `package:${details.multiBooking._id}`
					})
				).map(() => details)
			)
			// Create the Calendar event before persisting its identifiers with the booking.
			.andThen((details) =>
				fromConvexTuple(
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
				fromConvexTuple(
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

					return fromConvexTuple(
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
		fromConvexTuple(
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
				fromConvexTuple(
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
				fromConvexTuple(
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
						fromConvexTuple(
							ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
								bookingId: args.bookingId,
								reservation
							})
						).andThen(() => err(calendarError))
					)
			)
			// Persist the new booking details and release the reservation if the save is rejected.
			.andThen(({ calendar, details, reservation }) =>
				fromConvexTuple(
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
					// TODO: If Calendar updates but this Convex save fails, Calendar keeps the new time
					// while the booking keeps the old time. Mark the booking with a Calendar sync
					// warning so an admin can compare it with Calendar and update it manually.
					.orElse((saveError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
								bookingId: args.bookingId,
								reservation
							})
						).andThen(() => err(saveError))
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
		fromConvexTuple(
			ctx.runQuery(internal.packageScheduling.validatePackageUnscheduleRequest, { ...args, now })
		)
			// Delete the Calendar event before marking the booking cancelled.
			.andThen((details) =>
				fromConvexTuple(
					ctx.runAction(internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
						session: toPackageCalendarSession(details.session)
					})
				)
			)
			// Persist cancellation only after Calendar deletion succeeds or reports the event missing.
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.packageScheduling.cancelPackageSession, {
						bookingId: args.bookingId,
						now,
						token: args.token
					})
				)
			)
	);
}

export type SaveCreatedPackageSessionArgs = PackageSessionArgs & {
	now: number;
	googleCalendarId?: string;
	googleEventId?: string;
};

export type CancelPackageSessionArgs = { bookingId: Id<"bookings">; token: string; now: number };

export function validatePackageSessionRequestService(
	ctx: QueryCtx,
	args: PackageSessionRequestArgs
): ResultAsync<PackageSessionRequestDetails, CreatePackageSessionError> {
	return (
		getValidPackageByToken(ctx, args.token, args.now)
			// Load availability settings after validating the package link.
			.andThen((multiBooking) =>
				okOrThrow<SessionAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(settings) => ({ multiBooking, settings })
				)
			)
			// Enforce package availability before reading sessions that consume capacity.
			.andThen(({ multiBooking, settings }) =>
				checkPackageSessionAvailability(args, multiBooking, settings, args.now).map(() => ({
					multiBooking,
					settings
				}))
			)
			// Confirm a package slot remains before parsing the requested start time.
			.andThen(({ multiBooking, settings }) =>
				okOrThrow(
					getCapacityConsumingPackageSessions(ctx, multiBooking._id, multiBooking.packageSize)
				).andThen((bookings) => {
					if (bookings.length >= multiBooking.packageSize) {
						return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
					}

					return ok({ multiBooking, settings });
				})
			)
			// Parse the start time and return only the details needed by the action service.
			.andThen(({ multiBooking, settings }) =>
				getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
					(sessionStartAt) => ({
						multiBooking,
						eventBufferMinutes: settings.eventBufferMinutes,
						leadTimeMinutes: settings.leadTimeMinutes,
						sessionStartAt
					})
				)
			)
	);
}

export function validatePackageRescheduleRequestService(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
): ResultAsync<PackageRescheduleRequestDetails, ReschedulePackageSessionError> {
	return getEditablePackageSession(ctx, args)
		.andThen((details) =>
			checkPackageSessionAvailability(args, details.multiBooking, details.settings, args.now).map(
				() => details
			)
		)
		.andThen(({ session, multiBooking, settings }) =>
			getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
				(sessionStartAt) => ({
					session,
					multiBooking,
					eventBufferMinutes: settings.eventBufferMinutes,
					sessionStartAt
				})
			)
		);
}

export function validatePackageUnscheduleRequestService(
	ctx: QueryCtx,
	args: PackageUnscheduleRequestArgs
): ResultAsync<
	PackageUnscheduleRequestDetails,
	ValidPackageByTokenError | UnschedulePackageSessionError
> {
	return getEditablePackageSession(ctx, args).map(({ session, multiBooking }) => ({
		session,
		multiBooking
	}));
}

export function processPackageAdjustmentAtExpiryService(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; expectedExpiresAt: number }
) {
	return processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
}

export function processPackageAdjustmentWhenSessionsCompleteService(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	return processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
}

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

				return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
					(sessionStartAt) => ({ packageFromDb, sessionStartAt })
				);
			})
			// Save the confirmed booking with the package and session snapshots.
			.andThen(({ packageFromDb, sessionStartAt }) =>
				getOrCreateDriveClientId(ctx, {
					email: packageFromDb.email,
					displayName: getClientFolderName({
						accountName: packageFromDb.accountName,
						contactName: packageFromDb.name
					})
				}).andThen((driveClientId) =>
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
								completeEditQuantity: packageFromDb.completeEditQuantity,
								clipsPackageQuantity: packageFromDb.clipsPackageQuantity,
								handcraftedClipsQuantity: packageFromDb.handcraftedClipsQuantity,
								notes: args.notes,
								status: "confirmed",
								pendingPaymentCreatedAt: packageFromDb.createdAt,
								paymentCompletedAt: packageFromDb.paidAt,
								bookingConfirmedAt: args.now,
								googleCalendarId: args.googleCalendarId,
								googleEventId: args.googleEventId,
								multiBookingPackageId: packageFromDb._id,
								driveClientId
							})
							.then((bookingId) => ({ bookingId, packageFromDb }))
					)
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
