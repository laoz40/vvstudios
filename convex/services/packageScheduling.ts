import { err, ok, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getOrCreateDriveClientId } from "#convex/lib/driveFolders";
import { scheduleDriveSetup } from "#convex/lib/driveScheduling";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
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
	packageRecord: ValidPackage;
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	sessionStartAt: number;
};

export type PackageRescheduleRequestDetails = {
	session: Doc<"bookings">;
	packageRecord: ValidPackage;
	eventBufferMinutes: number;
	sessionStartAt: number;
};

export type PackageUnscheduleRequestDetails = {
	session: Doc<"bookings">;
	packageRecord: ValidPackage;
};

export function getPackageByTokenService(ctx: QueryCtx, token: string) {
	return getValidPackageByToken(ctx, token, Date.now())
		.andThen((packageRecord) =>
			okOrThrow(
				getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize)
			).map((sessions) => ({ packageRecord, sessions }))
		)
		.map(({ packageRecord, sessions }) => ({
			_id: packageRecord._id,
			name: packageRecord.name,
			email: packageRecord.email,
			duration: packageRecord.duration,
			addons: packageRecord.addons,
			essentialEditQuantity: packageRecord.essentialEditQuantity,
			completeEditQuantity: packageRecord.completeEditQuantity,
			clipsPackageQuantity: packageRecord.clipsPackageQuantity,
			handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity,
			packageSize: packageRecord.packageSize,
			expiresAt: packageRecord.expiresAt,
			defaultSpace: packageRecord.defaultSpace,
			sessions: sessions.map((session) => {
				const mappedSession: PackageSessionSummary = {
					_id: session._id,
					date: session.date,
					time: session.time,
					sessionStartAt: session.sessionStartAt,
					notes: session.notes ?? "",
					service: session.service,
					addons: session.addons
				};

				if (!session.googleEventId) {
					return mappedSession;
				}

				mappedSession.googleEventId = session.googleEventId;
				return mappedSession;
			})
		}));
}

export function setPackageDefaultSpaceService(
	ctx: MutationCtx,
	args: { service: RecordingSpace; token: string }
) {
	return getValidPackageByToken(ctx, args.token, Date.now()).andThen((packageRecord) =>
		okOrThrow(
			ctx.db
				.patch(packageRecord._id, { defaultSpace: args.service })
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
						submitRateLimitKey: `package:${details.packageRecord._id}`
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
							details.packageRecord,
							details.eventBufferMinutes
						)
					})
				).map((calendar) => ({ calendar, details }))
			)
			// Save the booking, deleting an orphaned Calendar event if an expected save check loses a race.
			.andThen(({ calendar, details }) => {
				const saveArgs: SaveCreatedPackageSessionArgs = { ...args, now };

				if (calendar.googleCalendarId) {
					saveArgs.googleCalendarId = calendar.googleCalendarId;
				}
				if (calendar.googleEventId) {
					saveArgs.googleEventId = calendar.googleEventId;
				}

				return fromConvexTuple(
					ctx.runMutation(internal.packageScheduling.saveCreatedPackageSession, saveArgs)
				).orElse((saveError) => {
					if (!calendar.googleEventId || !calendar.googleCalendarId) {
						return err(saveError);
					}

					return fromConvexTuple(
						ctx.runAction(internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
							session: {
								date: args.date,
								duration: details.packageRecord.duration,
								email: details.packageRecord.email,
								googleCalendarId: calendar.googleCalendarId,
								googleEventId: calendar.googleEventId,
								name: details.packageRecord.name,
								time: args.time
							}
						})
					)
						.mapErr((cleanupError) => {
							console.error("Failed to compensate orphan package Calendar event", cleanupError);
							return saveError;
						})
						.andThen(() => err(saveError));
				});
			})
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
						duration: details.packageRecord.duration,
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
							details.packageRecord,
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
						addons: getPackageSessionAddons(details.packageRecord.addons, args.remotePodcast),
						sessionStartAt: details.sessionStartAt,
						googleCalendarId: calendar.googleCalendarId,
						googleEventId: calendar.googleEventId,
						packageId: details.packageRecord._id,
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

type PackageSessionSummary = {
	_id: Id<"bookings">;
	date: string;
	time: string;
	sessionStartAt: number;
	notes: string;
	service: string;
	addons: Doc<"bookings">["addons"];
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
			.andThen((packageRecord) =>
				okOrThrow<SessionAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
					(settings) => ({ packageRecord, settings })
				)
			)
			// Enforce package availability before reading sessions that consume capacity.
			.andThen(({ packageRecord, settings }) =>
				checkPackageSessionAvailability(args, packageRecord, settings, args.now).map(() => ({
					packageRecord,
					settings
				}))
			)
			// Confirm a package slot remains before parsing the requested start time.
			.andThen(({ packageRecord, settings }) =>
				okOrThrow(
					getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize)
				).andThen((bookings) => {
					if (bookings.length >= packageRecord.packageSize) {
						return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
					}

					return ok({ packageRecord, settings });
				})
			)
			// Parse the start time and return only the details needed by the action service.
			.andThen(({ packageRecord, settings }) =>
				getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
					(sessionStartAt) => ({
						packageRecord,
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
			checkPackageSessionAvailability(args, details.packageRecord, details.settings, args.now).map(
				() => details
			)
		)
		.andThen(({ session, packageRecord, settings }) =>
			getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
				(sessionStartAt) => ({
					session,
					packageRecord,
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
	return getEditablePackageSession(ctx, args).map(({ session, packageRecord }) => ({
		session,
		packageRecord
	}));
}

export function processPackageAdjustmentAtExpiryService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number }
) {
	return processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
}

export function processPackageAdjustmentWhenSessionsCompleteService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages"> }
) {
	return processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
}

export function saveCreatedPackageSessionService(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	schedulePackageAdjustment: (packageId: Id<"packages">) => Promise<Id<"_scheduled_functions">>
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
					displayName: formatDriveClientFolderName({
						accountName: packageFromDb.accountName,
						contactName: packageFromDb.name
					})
				}).andThen((driveClientId) =>
					okOrThrow(
						ctx.db.insert("bookings", {
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
							packageId: packageFromDb._id,
							driveClientId
						})
					).andThen((bookingId) =>
						ResultAsync.fromSafePromise(
							scheduleDriveSetup(ctx, {
								bookingId,
								sessionStartAt,
								duration: packageFromDb.duration,
								packageId: packageFromDb._id
							})
						).andThen((scheduled) => scheduled.map(() => ({ bookingId, packageFromDb })))
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
