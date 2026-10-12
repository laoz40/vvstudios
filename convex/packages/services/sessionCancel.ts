import { ok, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getPackageSessionForToken,
	rejectMissingCapacityConsumingPackageSession
} from "#convex/packages/lib/scheduling";
import { archiveDeadCheckoutBooking } from "#convex/sessions/services/archive";

export function cancelPackageSessionBooking(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		yield* archiveDeadCheckoutBooking(ctx, bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: undefined,
			reminderEmailFailureCode: undefined,
			status: "cancelled" as const
		});

		return ok({ cancelled: true as const, bookingId });
	});
}

export function loadPackageSessionOwnedByToken(
	ctx: MutationCtx,
	packageFromDb: Doc<"packages">,
	bookingId: Id<"bookings">
) {
	return safeTry(async function* () {
		const session = yield* getPackageSessionForToken(ctx, packageFromDb._id, bookingId);
		const validSession = yield* rejectMissingCapacityConsumingPackageSession(session);

		return ok(validSession);
	});
}
