import { type Result, type ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";

import { getOrCreateDriveClientId } from "#convex/drive/services/setup";
import { insertPackageSessionBookingRow as persistPackageSessionBookingRow } from "#convex/packages/lib/sessionBookings";

import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/packages/lib/adjustmentScheduling";
import {
	getCapacityConsumingPackageSessions,
	rejectLockedEditablePackageSession,
	rejectWhenPackageCapacityFull,
	type PackageSessionEditError,
	type UnschedulePackageSessionError
} from "#convex/packages/lib/scheduling";
import { type ValidPackage, type ValidPackageByTokenError } from "#convex/packages/lib/lookup";
import { getValidPackageByToken } from "#convex/packages/services/tokenScheduling";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import type { SessionTimeParseError } from "#convex/sessions/lib/calendarTime";
import { checkSessionMeetsAvailabilitySettings } from "#convex/sessions/services/calendarTime";

import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	type PackageSessionRequestDetails as LibPackageSessionRequestDetails,
	type PackageRescheduleRequestDetails as LibPackageRescheduleRequestDetails,
	type PackageUnscheduleRequestDetails as LibPackageUnscheduleRequestDetails,
	type SaveCreatedPackageSessionArgs as LibSaveCreatedPackageSessionArgs,
	packageSessionAvailabilityArgs,
	validateRemainingPackageCapacity,
	packageDriveClientArgs,
	buildPackageBookingFields,
	clearPendingPackageReminder,
	attachPackageSessionForToken,
	loadSettingsForEditableSession,
	loadBookingSettingsForPackage,
	parseCreateStartTimeForPackage,
	parseRescheduleStartTimeForSession,
	loadCapacityConsumingSessionsForPackage,
	parseCreatedSessionStartTime,
	scheduleDriveSetupAfterPackageSessionInsert
} from "#convex/packages/lib/sessionMutationsSteps";

function checkPackageSessionAvailability(
	args: { date: string; time: string },
	packageRecord: ValidPackage,
	settings: SessionAvailabilitySettings,
	now: number
) {
	return checkSessionMeetsAvailabilitySettings(
		packageSessionAvailabilityArgs(args, packageRecord, settings, now)
	);
}

type EditablePackageSessionDetails = {
	packageRecord: ValidPackage;
	session: Doc<"bookings">;
	settings: SessionAvailabilitySettings;
};

function getEditablePackageSession(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
): ResultAsyncType<
	EditablePackageSessionDetails,
	ValidPackageByTokenError | PackageSessionEditError
> {
	return getValidPackageByToken(ctx, args.token, args.now)
		.andThen((packageRecord: ValidPackage) =>
			attachPackageSessionForToken(ctx, args.bookingId, packageRecord)
		)
		.andThen((_value) => loadSettingsForEditableSession(ctx, _value))
		.andThen((details: EditablePackageSessionDetails) =>
			rejectLockedEditablePackageSession(args.now, details)
		);
}

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

type PackageUnscheduleRequestArgs = { bookingId: Id<"bookings">; token: string; now: number };

export type PackageSessionRequestDetails = LibPackageSessionRequestDetails;

export type PackageRescheduleRequestDetails = LibPackageRescheduleRequestDetails;

export type PackageUnscheduleRequestDetails = LibPackageUnscheduleRequestDetails;

export type SaveCreatedPackageSessionArgs = LibSaveCreatedPackageSessionArgs;

export function loadValidPackageAndBookingSettings(ctx: QueryCtx, args: PackageSessionRequestArgs) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen((packageRecord: ValidPackage) =>
		loadBookingSettingsForPackage(ctx, packageRecord)
	);
}

export function rejectPackageCreateWhenUnavailableOrFull(
	ctx: QueryCtx,
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	return checkPackageSessionAvailability(args, packageRecord, settings, args.now).asyncAndThen(() =>
		loadAvailablePackageCapacity(ctx, packageRecord, settings)
	);
}

function loadAvailablePackageCapacity(
	ctx: QueryCtx,
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	return getCapacityConsumingPackageSessions(
		ctx,
		packageRecord._id,
		packageRecord.packageSize
	).andThen((bookings) => rejectWhenPackageCapacityFull(packageRecord, settings, bookings));
}

export function parsePackageSessionCreateStartTime(
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return parseCreateStartTimeForPackage(args, packageRecord, settings);
}

export function loadEditablePackageSessionForReschedule(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
) {
	return getEditablePackageSession(ctx, args).andThen((details: EditablePackageSessionDetails) =>
		ensureRescheduleSlotAvailable(args, details)
	);
}

function ensureRescheduleSlotAvailable(
	args: PackageRescheduleRequestArgs,
	details: EditablePackageSessionDetails
) {
	return checkPackageSessionAvailability(
		args,
		details.packageRecord,
		details.settings,
		args.now
	).map(() => details);
}

export function parsePackageRescheduleStartTime(
	args: PackageRescheduleRequestArgs,
	details: {
		session: Doc<"bookings">;
		packageRecord: ValidPackage;
		settings: { eventBufferMinutes: number };
	}
) {
	return parseRescheduleStartTimeForSession(args, details);
}

export function loadEditablePackageSessionForUnschedule(
	ctx: QueryCtx,
	args: PackageUnscheduleRequestArgs
): ResultAsyncType<
	PackageUnscheduleRequestDetails,
	ValidPackageByTokenError | UnschedulePackageSessionError
> {
	return getEditablePackageSession(ctx, args).map(({ session, packageRecord }) => ({
		session,
		packageRecord
	}));
}

export function loadValidPackageAndCapacityConsumingSessions(
	ctx: MutationCtx,
	args: Pick<SaveCreatedPackageSessionArgs, "token" | "now">
) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen((packageFromDb: ValidPackage) =>
		loadCapacityConsumingSessionsForPackage(ctx, packageFromDb)
	);
}

export function rejectFullPackageAndParseSessionStartTime(
	args: Pick<SaveCreatedPackageSessionArgs, "date" | "time">,
	packageFromDb: ValidPackage,
	packageSessions: Doc<"bookings">[]
): Result<
	{ packageFromDb: ValidPackage; sessionStartAt: number },
	| { reason: "PACKAGE_CAPACITY_EXCEEDED" }
	| Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
> {
	return validateRemainingPackageCapacity(packageFromDb, packageSessions).andThen(() =>
		parseCreatedSessionStartTime(args, packageFromDb)
	);
}

export function insertPackageSessionBookingRow(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number
) {
	return getOrCreateDriveClientId(ctx, packageDriveClientArgs(packageFromDb)).andThen(
		(driveClientId: Id<"driveClients">) =>
			persistPackageSessionAfterDriveClient(ctx, args, packageFromDb, sessionStartAt, driveClientId)
	);
}

function persistPackageSessionAfterDriveClient(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number,
	driveClientId: Id<"driveClients">
) {
	const bookingFields = buildPackageBookingFields(
		args,
		packageFromDb,
		sessionStartAt,
		driveClientId
	);

	return persistPackageSessionBookingRow(ctx, bookingFields).andThen((bookingId: Id<"bookings">) =>
		scheduleDriveSetupAfterPackageSessionInsert(ctx, packageFromDb, sessionStartAt, bookingId)
	);
}

export function clearPackageExpiryReminderStateWhenPending(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	bookingId: Id<"bookings">
) {
	return clearPendingPackageReminder(ctx, packageFromDb, bookingId);
}

export function schedulePackageAdjustmentWhenAllSessionsBooked(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	bookingId: Id<"bookings">
) {
	return schedulePackageAdjustmentWhenSessionsComplete(ctx, packageId).map(() => ({ bookingId }));
}
