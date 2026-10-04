import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getPackageFromDb, type PackageLookupError } from "#convex/lib/packages/packageLookup";
import {
	buildPackagePaidLifecyclePatch,
	buildPaidPackageResult,
	patchPackagePaidLifecycle,
	rejectAlreadyPaidPackage,
	schedulePackageAdjustmentAtExpiry
} from "#convex/lib/packages/packagePaidLifecycle";
import { createPackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";

export function recordPackagePaidAndIssueScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(rejectAlreadyPaidPackage)
		.andThen((packageFromDb) => createPackageSchedulingDetails(packageFromDb, args.paidAt))
		.andThen((packageSchedulingDetails) => {
			const patch = buildPackagePaidLifecyclePatch(
				packageSchedulingDetails.packageFromDb,
				args.paidAt,
				packageSchedulingDetails
			);

			return patchPackagePaidLifecycle(ctx, args.packageId, patch).map(
				() => packageSchedulingDetails
			);
		})
		.andThen((packageSchedulingDetails) =>
			schedulePackageAdjustmentAtExpiry(
				ctx,
				args.packageId,
				packageSchedulingDetails.expiresAt
			).map(() => packageSchedulingDetails)
		)
		.map((packageSchedulingDetails) =>
			buildPaidPackageResult(packageSchedulingDetails, args.paidAt)
		);
}

export type RecordPackagePaidError = PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" };
