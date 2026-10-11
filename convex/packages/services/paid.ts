import type { ResultAsync as ResultAsyncType } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { PackageLookupError } from "#convex/packages/lib/lookup";
import type { PaidPackageResult } from "#convex/packages/lib/payment";
import {
	buildPaidPackageResult,
	patchPackagePaidAfterSchedulingDetails,
	rejectAlreadyPaidPackage,
	schedulePackageAdjustmentAtExpiry
} from "#convex/packages/lib/paidLifecycle";
import { createPackageSchedulingDetails } from "#convex/packages/lib/scheduling";
import { getPackageFromDb } from "#convex/packages/services/lookup";

export function markPackagePaidWithScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
): ResultAsyncType<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(rejectAlreadyPaidPackage)
		.andThen((packageFromDb) => createPackageSchedulingDetails(packageFromDb, args.paidAt))
		.andThen((details) =>
			patchPackagePaidAfterSchedulingDetails(ctx, args.packageId, args.paidAt, details)
		)
		.andThen((details) =>
			schedulePackageAdjustmentAtExpiry(ctx, args.packageId, details.expiresAt).map(() => details)
		)
		.map((details) => buildPaidPackageResult(details, args.paidAt));
}
