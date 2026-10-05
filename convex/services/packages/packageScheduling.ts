import { err, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { getOrCreateDriveClientId } from "#convex/lib/drive/driveFolders";
import { buildBookingSearchBlob } from "#convex/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import { processPackageAdjustment } from "#convex/lib/packages/packageAdjustments";
import {
	checkPackageSessionAvailability,
	getCapacityConsumingPackageSessions,
	getEditablePackageSession,
	getPackageSessionForToken,
	sessionConsumesPackageCapacity,
	type CreatePackageSessionError,
	type ReschedulePackageSessionError,
	type UnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";
import {
	getValidPackageByToken,
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";
import { archiveDeadCheckoutBooking } from "#convex/lib/sessions/sessionArchive";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
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

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

type PackageUnscheduleRequestArgs = { bookingId: Id<"bookings">; token: string; now: number };

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
			getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
				(sessions) => ({ packageRecord, sessions })
			)
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
				.patch("packages", packageRecord._id, { defaultSpace: args.service })
				.then(() => ({ defaultSpace: args.service }))
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
				getBookingAvailabilitySettings(ctx).map((settings) => ({ packageRecord, settings }))
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
				getCapacityConsumingPackageSessions(
					ctx,
					packageRecord._id,
					packageRecord.packageSize
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

export async function processPackageAdjustmentAtExpiryService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}

export async function processPackageAdjustmentWhenSessionsCompleteService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages"> }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}

export function saveCreatedPackageSessionService(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs
) {
	return (
		getValidPackageByToken(ctx, args.token, args.now)
			// Load the sessions that currently consume this package's capacity.
			.andThen((packageFromDb) =>
				getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize).map(
					(packageSessions) => ({ packageFromDb, packageSessions })
				)
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
				}).andThen((driveClientId) => {
					const bookingFields = {
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
						status: "confirmed" as const,
						pendingPaymentCreatedAt: packageFromDb.createdAt,
						paymentCompletedAt: packageFromDb.paidAt,
						bookingConfirmedAt: args.now,
						googleCalendarId: args.googleCalendarId,
						googleEventId: args.googleEventId,
						packageId: packageFromDb._id,
						receiptNumber: packageFromDb.receiptNumber,
						archived: false,
						driveClientId
					};

					return okOrThrow(
						ctx.db.insert("bookings", {
							...bookingFields,
							searchBlob: buildBookingSearchBlob(bookingFields)
						})
					).andThen((bookingId) =>
						scheduleDriveSetup(ctx, {
							bookingId,
							sessionStartAt,
							duration: packageFromDb.duration,
							packageId: packageFromDb._id
						}).map(() => ({ bookingId, packageFromDb }))
					);
				})
			)
			// Clear expiry reminder after the customer schedules another session.
			.andThen(({ bookingId, packageFromDb }) => {
				if (packageFromDb.packageReminderState?.type !== "expiry") {
					return ok({ bookingId, packageFromDb });
				}

				return okOrThrow(
					ctx.db
						.patch("packages", packageFromDb._id, { packageReminderState: undefined })
						.then(() => ({ bookingId, packageFromDb }))
				);
			})
			// Check whether every package slot is now scheduled. Once full, adjustment processing
			// waits for the final session to end before recording whether Remote Podcast charges are due.
			.andThen(({ bookingId, packageFromDb }) =>
				schedulePackageAdjustmentWhenSessionsComplete(ctx, packageFromDb._id).map(() => ({
					bookingId
				}))
			)
	);
}

export function cancelPackageSessionService(ctx: MutationCtx, args: CancelPackageSessionArgs) {
	return (
		getValidPackageByToken(ctx, args.token, args.now)
			// Load the session through the package to enforce ownership.
			.andThen((packageFromDb) =>
				getPackageSessionForToken(ctx, packageFromDb._id, args.bookingId).map((session) => ({
					packageFromDb,
					session
				}))
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
				archiveDeadCheckoutBooking(ctx, args.bookingId, {
					bookingFailureCode: undefined,
					googleCalendarId: undefined,
					googleEventId: undefined,
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined,
					status: "cancelled"
				}).map(() => ({ cancelled: true as const, bookingId: args.bookingId }))
			)
	);
}
