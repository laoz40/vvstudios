import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getPackageSessionForToken,
	rejectMissingCapacityConsumingPackageSession
} from "#convex/packages/lib/packageScheduling";
import { archiveDeadCheckoutBooking } from "#convex/sessions/services/sessionArchive";

function cancelledPackageSessionBookingResult(bookingId: Id<"bookings">) {
	return { cancelled: true as const, bookingId };
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
	}).map(() => cancelledPackageSessionBookingResult(bookingId));
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
