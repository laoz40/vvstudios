import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export function getPackageFromDb(ctx: MutationCtx, multiBookingId: Id<"multiBookingPackages">) {
	return ResultAsync.fromSafePromise(ctx.db.get(multiBookingId)).andThen((multiBooking) => {
		if (!multiBooking) {
			return err({ reason: "PACKAGE_NOT_FOUND" as const });
		}

		return ok(multiBooking);
	});
}
