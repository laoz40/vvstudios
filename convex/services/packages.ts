import { err, ok } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { getPackageFromDb } from "../lib/packageLookup";
import { getCapacityConsumingPackageSessions } from "../lib/packageScheduling";
import {
	buildPackageUpdatePatch,
	parsePackageUpdate,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "../lib/packageUpdates";
import { okOrThrow } from "../lib/result";

type SavePackageInstagramHandleArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	instagramHandle: string;
};
type ArchivePackageArgs = { multiBookingId: Id<"multiBookingPackages">; archived: boolean };
export function updatePackageService(ctx: MutationCtx, args: UpdatePackageArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen((existingPackage) =>
			parsePackageUpdate(args).map((updatedPackage) => ({ existingPackage, updatedPackage }))
		)
		.andThen(({ existingPackage, updatedPackage }) =>
			okOrThrow(
				getCapacityConsumingPackageSessions(ctx, existingPackage._id, existingPackage.packageSize)
			).map((activeBookedSessions) => ({ activeBookedSessions, updatedPackage }))
		)
		.andThen(({ activeBookedSessions, updatedPackage }) =>
			validatePackageUpdate(args, updatedPackage, activeBookedSessions.length)
		)
		.andThen((updatedPackage) =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, buildPackageUpdatePatch(args, updatedPackage))
					.then(() => null)
			)
		);
}

export function savePackageInstagramHandleService(
	ctx: MutationCtx,
	args: SavePackageInstagramHandleArgs
) {
	return getPackageFromDb(ctx, args.multiBookingId)
		.andThen((existingPackage) => {
			if (existingPackage.status !== "pending_payment" && existingPackage.status !== "paid") {
				return err({ reason: "PACKAGE_NOT_ACTIVE" as const });
			}
			return ok(existingPackage);
		})
		.andThen((existingPackage) =>
			okOrThrow(
				ctx.db
					.patch(existingPackage._id, { instagramHandle: args.instagramHandle })
					.then(() => null)
			)
		);
}

export function archivePackageService(ctx: MutationCtx, args: ArchivePackageArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, { hiddenAt: args.archived ? Date.now() : undefined })
					.then(() => null)
			)
		);
}
