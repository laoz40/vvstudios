import { err, errAsync, ok, okAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { getOrCreateDriveClientId } from "#convex/lib/drive/driveFolders";
import { buildBookingSearchBlob } from "#convex/lib/adminSearch/adminSearchBlob";
import { scheduleDriveSetup } from "#convex/lib/drive/driveScheduling";
import { formatDriveClientFolderName } from "#studio/lib/bookingdatetime";
import { schedulePackageAdjustmentWhenSessionsComplete } from "#convex/lib/packages/packageAdjustmentScheduling";
import {
	checkPackageSessionAvailability,
	getCapacityConsumingPackageSessions,
	getEditablePackageSession,
	type UnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";
import {
	getValidPackageByToken,
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import { env } from "#convex/env";
import { getPackageSessionAddons } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

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

export function loadValidPackageAndBookingSettings(ctx: QueryCtx, args: PackageSessionRequestArgs) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen((packageRecord) =>
		getBookingAvailabilitySettings(ctx).map((settings) => ({ packageRecord, settings }))
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
	).andThen((bookings) => {
		if (bookings.length >= packageRecord.packageSize) {
			return err({ reason: "PACKAGE_CAPACITY_EXCEEDED" as const });
		}

		return ok({ packageRecord, settings });
	});
}

export function parsePackageSessionCreateStartTime(
	args: PackageSessionRequestArgs,
	packageRecord: ValidPackage,
	settings: { eventBufferMinutes: number; leadTimeMinutes: number }
) {
	return okAsync(null).andThen(() =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map((sessionStartAt) => ({
			packageRecord,
			eventBufferMinutes: settings.eventBufferMinutes,
			leadTimeMinutes: settings.leadTimeMinutes,
			sessionStartAt
		}))
	);
}

export function loadEditablePackageSessionForReschedule(
	ctx: QueryCtx,
	args: PackageRescheduleRequestArgs
) {
	return getEditablePackageSession(ctx, args).andThen((details) => {
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
	return okAsync(null).andThen(() =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map((sessionStartAt) => ({
			session: details.session,
			packageRecord: details.packageRecord,
			eventBufferMinutes: details.settings.eventBufferMinutes,
			sessionStartAt
		}))
	);
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
	return getValidPackageByToken(ctx, args.token, args.now).andThen((packageFromDb) =>
		getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize).map(
			(packageSessions) => ({ packageFromDb, packageSessions })
		)
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

	return okAsync(null).andThen(() =>
		getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE).map((sessionStartAt) => ({
			packageFromDb,
			sessionStartAt
		}))
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
	});
}

export function clearPackageExpiryReminderStateWhenPending(
	ctx: MutationCtx,
	packageFromDb: ValidPackage,
	bookingId: Id<"bookings">
) {
	if (packageFromDb.packageReminderState?.type !== "expiry") {
		return okAsync({ bookingId, packageFromDb });
	}

	return okOrThrow(
		ctx.db
			.patch("packages", packageFromDb._id, { packageReminderState: undefined })
			.then(() => ({ bookingId, packageFromDb }))
	);
}

export function schedulePackageAdjustmentWhenAllSessionsBooked(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	bookingId: Id<"bookings">
) {
	return schedulePackageAdjustmentWhenSessionsComplete(ctx, packageId).map(() => ({ bookingId }));
}
