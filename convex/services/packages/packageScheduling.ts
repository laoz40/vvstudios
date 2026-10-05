import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { processPackageAdjustment } from "#convex/lib/packages/packageAdjustments";
import {
	getCapacityConsumingPackageSessions,
	getPackageSessionForToken,
	sessionConsumesPackageCapacity
} from "#convex/lib/packages/packageScheduling";
import { getValidPackageByToken } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";
import { archiveDeadCheckoutBooking } from "#convex/lib/sessions/sessionArchive";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

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
