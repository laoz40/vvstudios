import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

export function getPackageFromDb(ctx: MutationCtx, packageId: Id<"multiBookingPackages">) {
	return ResultAsync.fromSafePromise(ctx.db.get(packageId)).andThen((packageFromDb) => {
		if (!packageFromDb) {
			return err({ reason: "PACKAGE_NOT_FOUND" as const });
		}

		return ok(packageFromDb);
	});
}
