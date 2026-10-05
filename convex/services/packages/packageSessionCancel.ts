import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getPackageSessionForToken,
	sessionConsumesPackageCapacity
} from "#convex/lib/packages/packageScheduling";
import { archiveDeadCheckoutBooking } from "#convex/services/sessions/sessionArchive";

export function rejectMissingCapacityConsumingPackageSession(session: Doc<"bookings"> | null) {
	if (!session || !sessionConsumesPackageCapacity(session)) {
		return err({ reason: "PACKAGE_BOOKING_NOT_FOUND" as const });
	}

	return ok(session);
}

export function cancelPackageSessionBooking(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return archiveDeadCheckoutBooking(ctx, bookingId, {
		bookingFailureCode: undefined,
		googleCalendarId: undefined,
		googleEventId: undefined,
		reminderEmailClaimedAt: undefined,
		reminderEmailSentAt: undefined,
		reminderEmailFailureCode: undefined,
		status: "cancelled"
	}).map(() => ({ cancelled: true as const, bookingId }));
}

export function loadPackageSessionOwnedByToken(
	ctx: MutationCtx,
	packageFromDb: Doc<"packages">,
	bookingId: Id<"bookings">
) {
	return getPackageSessionForToken(ctx, packageFromDb._id, bookingId).andThen(
		rejectMissingCapacityConsumingPackageSession
	);
}
