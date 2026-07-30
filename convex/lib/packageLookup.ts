import { err, ok, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";

export type ValidPackageByTokenError =
	| { reason: "PACKAGE_LINK_INVALID" }
	| { reason: "PACKAGE_LINK_EXPIRED" }
	| { reason: "PACKAGE_LINK_INACTIVE" }
	| { reason: "PACKAGE_NOT_PAID" };

export type ValidPackage = Doc<"multiBookingPackages"> & { expiresAt: number };

export function getPackageFromDb(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"multiBookingPackages">
) {
	return ResultAsync.fromSafePromise(ctx.db.get(packageId)).andThen((packageFromDb) => {
		if (!packageFromDb) {
			return err({ reason: "PACKAGE_NOT_FOUND" as const });
		}

		return ok(packageFromDb);
	});
}

export function getValidPackageByToken(ctx: QueryCtx | MutationCtx, token: string, now: number) {
	return ResultAsync.fromSafePromise(hashRescheduleToken(token))
		.andThen((scheduleTokenHash) =>
			ResultAsync.fromSafePromise(
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_scheduleTokenHash", (query) =>
						query.eq("scheduleTokenHash", scheduleTokenHash)
					)
					.unique()
			)
		)
		.andThen((packageFromDb) => {
			if (!packageFromDb) {
				return err({ reason: "PACKAGE_LINK_INVALID" as const });
			}

			if (packageFromDb.status !== "paid" && packageFromDb.status !== "schedule_email_failed") {
				return err({ reason: "PACKAGE_NOT_PAID" as const });
			}

			if (packageFromDb.scheduleLinkStatus !== "active") {
				return err({ reason: "PACKAGE_LINK_INACTIVE" as const });
			}

			if (packageFromDb.expiresAt === undefined || now >= packageFromDb.expiresAt) {
				return err({ reason: "PACKAGE_LINK_EXPIRED" as const });
			}

			return ok({ ...packageFromDb, expiresAt: packageFromDb.expiresAt });
		});
}
