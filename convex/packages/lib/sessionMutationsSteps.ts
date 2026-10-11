import { err, ok, okAsync, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingAvailabilitySettings } from "#convex/booking/lib/settings";

import { patchPackageExpiryReminderStateCleared } from "#convex/packages/lib/updates";
import { scheduleDriveSetup } from "#convex/drive/lib/driveScheduling";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";

import {
	getCapacityConsumingPackageSessions,
	sessionConsumesPackageCapacity,
	getPackageSessionForToken
} from "#convex/packages/lib/scheduling";
import { type ValidPackage } from "#convex/packages/lib/lookup";

import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";

import { getSessionStartAt } from "#convex/sessions/lib/adminEdit";
import { env } from "#convex/env";
import { getPackageSessionAddons } from "#/domain/booking/catalog";
import type { BookingService } from "#/domain/booking/catalog";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type RecordingSpace = BookingService;

type PackageSessionRequestArgs = { token: string; date: string; time: string; now: number };

type PackageRescheduleRequestArgs = PackageSessionRequestArgs & { bookingId: Id<"bookings"> };

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

export function attachPackageSessionForToken(
	ctx: QueryCtx,
	bookingId: Id<"bookings">,
	packageRecord: ValidPackage
) {
	return getPackageSessionForToken(ctx, packageRecord._id, bookingId).map(
		(session: Doc<"bookings"> | null) => ({ packageRecord, session })
	);
}

export function loadSettingsForEditableSession(
	ctx: QueryCtx,
	{ packageRecord, session }: { packageRecord: ValidPackage; session: Doc<"bookings"> | null }
) {
	if (!session || !sessionConsumesPackageCapacity(session)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	return getBookingAvailabilitySettings(ctx).map((settings: SessionAvailabilitySettings) => ({
		packageRecord,
		session,
		settings
	}));
}

export function loadBookingSettingsForPackage(ctx: QueryCtx, packageRecord: ValidPackage) {
	return getBookingAvailabilitySettings(ctx).map((settings: BookingAvailabilitySettings) => ({
		packageRecord,
		settings
	}));
}

export function parseCreateStartTimeForPackage(
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
		(sessionStartAt: number) => ({
			packageRecord,
			eventBufferMinutes: settings.eventBufferMinutes,
			leadTimeMinutes: settings.leadTimeMinutes,
			sessionStartAt
		})
	);
}

export function parseRescheduleStartTimeForSession(
	args: PackageRescheduleRequestArgs,
	details: {
		session: Doc<"bookings">;
		packageRecord: ValidPackage;
		settings: { eventBufferMinutes: number };
	}
) {
	return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
		(sessionStartAt: number) => ({
			session: details.session,
			packageRecord: details.packageRecord,
			eventBufferMinutes: details.settings.eventBufferMinutes,
			sessionStartAt
		})
	);
}

export function loadCapacityConsumingSessionsForPackage(
	ctx: MutationCtx,
	packageFromDb: ValidPackage
) {
	return getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize).map(
		(packageSessions: Doc<"bookings">[]) => ({ packageFromDb, packageSessions })
	);
}

export function parseCreatedSessionStartTime(
	args: Pick<SaveCreatedPackageSessionArgs, "date" | "time">,
	packageFromDb: ValidPackage
): Result<
	{ packageFromDb: ValidPackage; sessionStartAt: number },
	Exclude<
		import("#convex/sessions/lib/calendarTime").SessionTimeParseError,
		{ reason: "BOOKING_INVALID_DURATION" }
	>
> {
	return getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map(
		(sessionStartAt: number) => ({ packageFromDb, sessionStartAt })
	);
}

export function scheduleDriveSetupAfterPackageSessionInsert(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	sessionStartAt: number,
	bookingId: Id<"bookings">
) {
	return scheduleDriveSetup(ctx, {
		bookingId,
		sessionStartAt,
		duration: packageFromDb.duration,
		packageId: packageFromDb._id
	}).map(() => ({ bookingId, packageFromDb }));
}

export function buildPackageBookingFields(
	args: SaveCreatedPackageSessionArgs,
	packageFromDb: ValidPackage,
	sessionStartAt: number,
	driveClientId: Id<"driveClients">
) {
	return {
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
}

export function clearPendingPackageReminder(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	bookingId: Id<"bookings">
) {
	if (packageFromDb.packageReminderState?.type !== "expiry") {
		return okAsync({ bookingId, packageFromDb });
	}

	return patchPackageExpiryReminderStateCleared(ctx, packageFromDb._id).map(() => ({
		bookingId,
		packageFromDb
	}));
}

export function packageSessionAvailabilityArgs(
	args: { date: string; time: string },
	packageRecord: ValidPackage,
	settings: SessionAvailabilitySettings,
	now: number
) {
	return {
		date: args.date,
		duration: packageRecord.duration,
		latestBookableDate: new Date(packageRecord.expiresAt),
		now,
		settings,
		time: args.time,
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	};
}

export function validateRemainingPackageCapacity(
	record: ValidPackage,
	sessions: Doc<"bookings">[]
): Result<null, { reason: "PACKAGE_CAPACITY_EXCEEDED" }> {
	return sessions.length >= record.packageSize
		? err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const })
		: ok(null);
}

export function packageDriveClientArgs(record: ValidPackage) {
	return {
		email: record.email,
		displayName: formatDriveClientFolderName({
			accountName: record.accountName,
			contactName: record.name
		})
	};
}

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
