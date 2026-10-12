import { ok, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";

import { getOrCreateDriveClientId } from "#convex/drive/services/setup";
import { insertPackageSessionBookingRow as persistPackageSessionBookingRow } from "#convex/packages/lib/sessionBookings";

import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/packages/lib/adjustmentScheduling";
import {
	getCapacityConsumingPackageSessions,
	rejectLockedEditablePackageSession,
	rejectWhenPackageCapacityFull
} from "#convex/packages/lib/scheduling";
import { type ValidPackage } from "#convex/packages/lib/lookup";
import { getValidPackageByToken } from "#convex/packages/services/tokenScheduling";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
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
) {
	return safeTry(async function* () {
		const packageRecord = yield* getValidPackageByToken(ctx, args.token, args.now);
		const attachedSession = yield* attachPackageSessionForToken(ctx, args.bookingId, packageRecord);
		const details = yield* loadSettingsForEditableSession(ctx, attachedSession);
		const editableDetails = yield* rejectLockedEditablePackageSession(args.now, details);

		return ok(editableDetails);
	});
}

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

type PackageUnscheduleRequestArgs = { bookingId: Id<"bookings">; token: string; now: number };

export type PackageSessionRequestDetails = LibPackageSessionRequestDetails;

export type PackageRescheduleRequestDetails = LibPackageRescheduleRequestDetails;

export type PackageUnscheduleRequestDetails = LibPackageUnscheduleRequestDetails;

export type SaveCreatedPackageSessionArgs = LibSaveCreatedPackageSessionArgs;

export function loadValidPackageAndBookingSettings(ctx: QueryCtx, args: PackageSessionRequestArgs) {
	return safeTry(async function* () {
		const packageRecord = yield* getValidPackageByToken(ctx, args.token, args.now);
		const details = yield* loadBookingSettingsForPackage(ctx, packageRecord);

		return ok(details);
	});
}

export function rejectPackageCreateWhenUnavailableOrFull(
	ctx: QueryCtx,
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	return safeTry(async function* () {
		yield* checkPackageSessionAvailability(args, packageRecord, settings, args.now);
		const capacity = yield* loadAvailablePackageCapacity(ctx, packageRecord, settings);

		return ok(capacity);
	});
}

function loadAvailablePackageCapacity(
	ctx: QueryCtx,
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	return safeTry(async function* () {
		const sessions = yield* getCapacityConsumingPackageSessions(
			ctx,
			packageRecord._id,
			packageRecord.packageSize
		);

		const capacity = yield* rejectWhenPackageCapacityFull(packageRecord, settings, sessions);

		return ok(capacity);
	});
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
	return safeTry(async function* () {
		const details = yield* getEditablePackageSession(ctx, args);
		const validatedDetails = yield* ensureRescheduleSlotAvailable(args, details);

		return ok(validatedDetails);
	});
}

function ensureRescheduleSlotAvailable(
	args: PackageRescheduleRequestArgs,
	details: EditablePackageSessionDetails
) {
	return safeTry(function* () {
		yield* checkPackageSessionAvailability(args, details.packageRecord, details.settings, args.now);

		return ok(details);
	});
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
) {
	return safeTry(async function* () {
		const details = yield* getEditablePackageSession(ctx, args);

		return ok({ session: details.session, packageRecord: details.packageRecord });
	});
}

export function loadValidPackageAndCapacityConsumingSessions(
	ctx: MutationCtx,
	args: Pick<SaveCreatedPackageSessionArgs, "token" | "now">
) {
	return safeTry(async function* () {
		const packageRecord = yield* getValidPackageByToken(ctx, args.token, args.now);
		const capacity = yield* loadCapacityConsumingSessionsForPackage(ctx, packageRecord);

		return ok(capacity);
	});
}

export function rejectFullPackageAndParseSessionStartTime(
	args: Pick<SaveCreatedPackageSessionArgs, "date" | "time">,
	packageFromDb: ValidPackage,
	packageSessions: Doc<"bookings">[]
) {
	return safeTry(function* () {
		yield* validateRemainingPackageCapacity(packageFromDb, packageSessions);
		const startTime = yield* parseCreatedSessionStartTime(args, packageFromDb);

		return ok(startTime);
	});
}

export function insertPackageSessionBookingRow(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number
) {
	return safeTry(async function* () {
		const driveClientId = yield* getOrCreateDriveClientId(
			ctx,
			packageDriveClientArgs(packageFromDb)
		);

		const booking = yield* persistPackageSessionAfterDriveClient(
			ctx,
			args,
			packageFromDb,
			sessionStartAt,
			driveClientId
		);

		return ok(booking);
	});
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

	return safeTry(async function* () {
		const booking = yield* persistPackageSessionBookingRow(ctx, bookingFields);

		const scheduledBooking = yield* scheduleDriveSetupAfterPackageSessionInsert(
			ctx,
			packageFromDb,
			sessionStartAt,
			booking
		);

		return ok(scheduledBooking);
	});
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
	return safeTry(async function* () {
		yield* schedulePackageAdjustmentWhenSessionsComplete(ctx, packageId);

		return ok({ bookingId });
	});
}
