import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getCapacityConsumingPackageSessions,
	getPackageSessionForToken,
	getPackageSessionStartAt,
	sessionConsumesPackageCapacity
} from "#convex/lib/packageScheduling";
import { getValidPackageByToken } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { getPackageSessionAddons } from "#studio/features/booking-form/lib/booking-form-model";

type PackageSessionArgs = {
	token: string;
	date: string;
	time: string;
	service: "Table Setup" | "Armchair Setup";
	notes?: string;
	remotePodcast: boolean;
};

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
