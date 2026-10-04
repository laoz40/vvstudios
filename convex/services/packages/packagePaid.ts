import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	buildPackagePaidLifecyclePatch,
	type PackageSchedulingDetails,
	patchPackagePaidLifecycle,
	schedulePackageAdjustmentAtExpiry
} from "#convex/lib/packages/packagePaidLifecycle";
import { createPackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";
import { okOrThrow } from "#convex/lib/result";

export function createPackageSchedulingDetailsForPayment(
	packageFromDb: Doc<"packages">,
	paidAt: number
) {
	return okOrThrow(createPackageSchedulingDetails(packageFromDb, paidAt));
}

export function recordPackagePaidLifecycle(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	paidAt: number,
	packageSchedulingDetails: PackageSchedulingDetails
) {
	const packageFromDb = packageSchedulingDetails.packageFromDb;
	const patch = buildPackagePaidLifecyclePatch(packageFromDb, paidAt, packageSchedulingDetails);

	return patchPackagePaidLifecycle(ctx, packageId, patch).map(() => packageSchedulingDetails);
}

export function schedulePaidPackageAdjustment(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	expiresAt: number
) {
	return schedulePackageAdjustmentAtExpiry(ctx, packageId, expiresAt);
}
