import { err, errAsync, ok, okAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { getOrCreateDriveClientId } from "#convex/services/drive/driveInternal";
import { insertPackageSessionBookingRow as persistPackageSessionBookingRow } from "#convex/lib/packages/packageSessionBookings";
import { patchPackageExpiryReminderStateCleared } from "#convex/lib/packages/packageUpdates";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import {
	checkPackageSessionAvailability,
	getCapacityConsumingPackageSessions,
	getPackageSessionForToken,
	type PackageSessionEditError,
	type UnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";
import {
	getValidPackageByToken,
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/lib/packages/packageLookup";
import { sessionConsumesPackageCapacity } from "#convex/lib/packages/packageSessionCapacity";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import { okOrThrow } from "#convex/lib/result";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import { env } from "#convex/env";
import { getPackageSessionAddons } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

type EditablePackageSessionDetails = {
	packageRecord: ValidPackage;
	session: Doc<"bookings">;
	settings: SessionAvailabilitySettings;
};

function attachPackageSessionRecord(packageRecord: ValidPackage) {
	return (session: Doc<"bookings"> | null) => ({ packageRecord, session });
}

function attachPackageSessionForToken(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return (packageRecord: ValidPackage) =>
		getPackageSessionForToken(ctx, packageRecord._id, bookingId).map(
			attachPackageSessionRecord(packageRecord)
		);
}

function attachAvailabilitySettingsToSession(
	packageRecord: ValidPackage,
	session: Doc<"bookings">
) {
	return (settings: SessionAvailabilitySettings) => ({ packageRecord, session, settings });
}

function loadSettingsForEditableSession(ctx: QueryCtx) {
	return ({
		packageRecord,
		session
	}: {
		packageRecord: ValidPackage;
		session: Doc<"bookings"> | null;
	}) => {
		if (!session || !sessionConsumesPackageCapacity(session)) {
			return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
		}

		return okOrThrow<SessionAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
			attachAvailabilitySettingsToSession(packageRecord, session)
		);
	};
}

function rejectLockedEditablePackageSession(now: number) {
	return (details: EditablePackageSessionDetails) => {
		if (
			isPackageSessionLocked(details.session.sessionStartAt, details.settings.leadTimeMinutes, now)
		) {
			return err({ reason: "PACKAGE_BOOKING_LOCKED" as const });
		}

		return ok(details);
	};
}

function getEditablePackageSession(
	ctx: QueryCtx,
	args: { token: string; bookingId: Id<"bookings">; now: number }
): ResultAsyncType<
	EditablePackageSessionDetails,
	ValidPackageByTokenError | PackageSessionEditError
> {
	return getValidPackageByToken(ctx, args.token, args.now)
		.andThen(attachPackageSessionForToken(ctx, args.bookingId))
		.andThen(loadSettingsForEditableSession(ctx))
		.andThen(rejectLockedEditablePackageSession(args.now));
}

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

export type SaveCreatedPackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: RecordingSpace;
	notes?: string;
	remotePodcast: boolean;
	now: number;
	googleCalendarId?: string;
	googleEventId?: string;
};

function attachPackageBookingSettings(packageRecord: ValidPackage) {
	return (settings: BookingAvailabilitySettings) => ({ packageRecord, settings });
}

function loadBookingSettingsForPackage(ctx: QueryCtx) {
	return (packageRecord: ValidPackage) =>
		getBookingAvailabilitySettings(ctx).map(attachPackageBookingSettings(packageRecord));
}

export function loadValidPackageAndBookingSettings(ctx: QueryCtx, args: PackageSessionRequestArgs) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen(
		loadBookingSettingsForPackage(ctx)
	);
}

export function rejectPackageCreateWhenUnavailableOrFull(
	ctx: QueryCtx,
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	const availability = checkPackageSessionAvailability(args, packageRecord, settings, args.now);

	if (availability.isErr()) {
		return errAsync(availability.error);
	}

	return getCapacityConsumingPackageSessions(
		ctx,
		packageRecord._id,
		packageRecord.packageSize
	).andThen(rejectWhenPackageCapacityFull(packageRecord, settings));
}

function rejectWhenPackageCapacityFull(
	packageRecord: ValidPackage,
	settings: BookingAvailabilitySettings
) {
	return (bookings: Doc<"bookings">[]) => {
		if (bookings.length >= packageRecord.packageSize) {
			return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
		}

		return ok({ packageRecord, settings });
	};
}

export function parsePackageSessionCreateStartTime(
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return okAsync(null).andThen(parseCreateStartTimeForPackage(args, packageRecord, settings));
}

function toPackageSessionRequestDetails(
	_args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return (sessionStartAt: number) => ({
		packageRecord,
		eventBufferMinutes: settings.eventBufferMinutes,
		leadTimeMinutes: settings.leadTimeMinutes,
		sessionStartAt
	});
}

function parseCreateStartTimeForPackage(
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return () =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
			toPackageSessionRequestDetails(args, packageRecord, settings)
		);
}

export function loadEditablePackageSessionForReschedule(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
) {
	return getEditablePackageSession(ctx, args).andThen(ensureRescheduleSlotAvailable(args));
}

function ensureRescheduleSlotAvailable(args: PackageRescheduleRequestArgs) {
	return (details: EditablePackageSessionDetails) => {
		const slotAvailability = checkPackageSessionAvailability(
			args,
			details.packageRecord,
			details.settings,
			args.now
		);

		if (slotAvailability.isErr()) {
			return errAsync(slotAvailability.error);
		}

		return okAsync(details);
	};
}

export function parsePackageRescheduleStartTime(
	args: PackageRescheduleRequestArgs,
	details: {
		session: Doc<"bookings">;
		packageRecord: ValidPackage;
		settings: { eventBufferMinutes: number };
	}
) {
	return okAsync(null).andThen(parseRescheduleStartTimeForSession(args, details));
}

function toPackageRescheduleRequestDetails(details: {
	session: Doc<"bookings">;
	packageRecord: ValidPackage;
	settings: { eventBufferMinutes: number };
}) {
	return (sessionStartAt: number) => ({
		session: details.session,
		packageRecord: details.packageRecord,
		eventBufferMinutes: details.settings.eventBufferMinutes,
		sessionStartAt
	});
}

function parseRescheduleStartTimeForSession(
	args: PackageRescheduleRequestArgs,
	details: {
		session: Doc<"bookings">;
		packageRecord: ValidPackage;
		settings: { eventBufferMinutes: number };
	}
) {
	return () =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
			toPackageRescheduleRequestDetails(details)
		);
}

export function loadEditablePackageSessionForUnschedule(
	ctx: QueryCtx,
	args: PackageUnscheduleRequestArgs
): ResultAsyncType<
	PackageUnscheduleRequestDetails,
	ValidPackageByTokenError | UnschedulePackageSessionError
> {
	return getEditablePackageSession(ctx, args).map(toPackageUnscheduleRequestDetails);
}

function toPackageUnscheduleRequestDetails({
	session,
	packageRecord
}: EditablePackageSessionDetails): PackageUnscheduleRequestDetails {
	return { session, packageRecord };
}

export function loadValidPackageAndCapacityConsumingSessions(
	ctx: MutationCtx,
	args: Pick<SaveCreatedPackageSessionArgs, "token" | "now">
) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen(
		loadCapacityConsumingSessionsForPackage(ctx)
	);
}

function attachCapacityConsumingSessionsForPackage(packageFromDb: ValidPackage) {
	return (packageSessions: Doc<"bookings">[]) => ({ packageFromDb, packageSessions });
}

function loadCapacityConsumingSessionsForPackage(ctx: MutationCtx) {
	return (packageFromDb: ValidPackage) =>
		getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize).map(
			attachCapacityConsumingSessionsForPackage(packageFromDb)
		);
}

export function rejectFullPackageAndParseSessionStartTime(
	args: Pick<SaveCreatedPackageSessionArgs, "date" | "time">,
	packageFromDb: ValidPackage,
	packageSessions: Doc<"bookings">[]
) {
	if (packageSessions.length >= packageFromDb.packageSize) {
		return errAsync({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
	}

	return okAsync(null).andThen(parseCreatedSessionStartTime(args, packageFromDb));
}

function toCreatedSessionStartTime(packageFromDb: ValidPackage) {
	return (sessionStartAt: number) => ({ packageFromDb, sessionStartAt });
}

function parseCreatedSessionStartTime(
	args: Pick<SaveCreatedPackageSessionArgs, "date" | "time">,
	packageFromDb: ValidPackage
) {
	return () =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
			toCreatedSessionStartTime(packageFromDb)
		);
}

export function insertPackageSessionBookingRow(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number
) {
	return getOrCreateDriveClientId(ctx, {
		email: packageFromDb.email,
		displayName: formatDriveClientFolderName({
			accountName: packageFromDb.accountName,
			contactName: packageFromDb.name
		})
	}).andThen(persistPackageSessionAfterDriveClient(ctx, args, packageFromDb, sessionStartAt));
}

function persistPackageSessionAfterDriveClient(
	ctx: MutationCtx,
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number
) {
	return (driveClientId: Id<"driveClients">) => {
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

		return persistPackageSessionBookingRow(ctx, bookingFields).andThen(
			scheduleDriveSetupAfterPackageSessionInsert(ctx, packageFromDb, sessionStartAt)
		);
	};
}

function scheduleDriveSetupAfterPackageSessionInsert(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	sessionStartAt: number
) {
	return (bookingId: Id<"bookings">) =>
		scheduleDriveSetup(ctx, {
			bookingId,
			sessionStartAt,
			duration: packageFromDb.duration,
			packageId: packageFromDb._id
		}).map(toPackageSessionInsertResult(packageFromDb, bookingId));
}

function toPackageSessionInsertResult(packageFromDb: ValidPackage, bookingId: Id<"bookings">) {
	return () => ({ bookingId, packageFromDb });
}

export function clearPackageExpiryReminderStateWhenPending(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	bookingId: Id<"bookings">
) {
	if (packageFromDb.packageReminderState?.type !== "expiry") {
		return okAsync({ bookingId, packageFromDb });
	}

	return patchPackageExpiryReminderStateCleared(ctx, packageFromDb._id).map(
		toClearedExpiryReminderResult(bookingId, packageFromDb)
	);
}

function toClearedExpiryReminderResult(bookingId: Id<"bookings">, packageFromDb: ValidPackage) {
	return () => ({ bookingId, packageFromDb });
}

export function schedulePackageAdjustmentWhenAllSessionsBooked(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	bookingId: Id<"bookings">
) {
	return schedulePackageAdjustmentWhenSessionsComplete(ctx, packageId).map(
		toScheduledAdjustmentResult(bookingId)
	);
}

function toScheduledAdjustmentResult(bookingId: Id<"bookings">) {
	return () => ({ bookingId });
}
