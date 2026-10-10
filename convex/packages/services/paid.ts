import type { ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { PackageLookupError } from "#convex/packages/lib/lookup";
import type { PaidPackageResult } from "#convex/packages/lib/payment";
import {
	buildPaidPackageResult,
	patchPackagePaidAfterSchedulingDetails,
	rejectAlreadyPaidPackage,
	schedulePackageAdjustmentAtExpiry
} from "#convex/packages/lib/paidLifecycle";
import {
	createPackageSchedulingDetails,
	type PackageSchedulingDetails
} from "#convex/packages/lib/scheduling";
import { getPackageFromDb } from "#convex/packages/services/lookup";

function createSchedulingDetailsForPaidAt(paidAt: number, packageFromDb: Doc<"packages">) {
	return createPackageSchedulingDetails(packageFromDb, paidAt);
}

function patchPaidPackageAfterSchedulingDetails(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number },

	packageSchedulingDetails: PackageSchedulingDetails
) {
	return patchPackagePaidAfterSchedulingDetails(
		ctx,
		args.packageId,
		args.paidAt,
		packageSchedulingDetails
	);
}

function scheduleAdjustmentAndKeepSchedulingDetails(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	packageSchedulingDetails: PackageSchedulingDetails
) {
	return schedulePackageAdjustmentAtExpiry(ctx, packageId, packageSchedulingDetails.expiresAt).map(
		() => packageSchedulingDetails
	);
}

function buildPaidPackageResultForPaidAt(
	paidAt: number,
	packageSchedulingDetails: Parameters<typeof buildPaidPackageResult>[0]
) {
	return buildPaidPackageResult(packageSchedulingDetails, paidAt);
}

export function markPackagePaidWithScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
): ResultAsyncType<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(rejectAlreadyPaidPackage)
		.andThen((packageFromDb: Doc<"packages">) =>
			createSchedulingDetailsForPaidAt(args.paidAt, packageFromDb)
		)
		.andThen((packageSchedulingDetails: PackageSchedulingDetails) =>
			patchPaidPackageAfterSchedulingDetails(ctx, args, packageSchedulingDetails)
		)
		.andThen((packageSchedulingDetails: PackageSchedulingDetails) =>
			scheduleAdjustmentAndKeepSchedulingDetails(ctx, args.packageId, packageSchedulingDetails)
		)
		.map((packageSchedulingDetails: Parameters<typeof buildPaidPackageResult>[0]) =>
			buildPaidPackageResultForPaidAt(args.paidAt, packageSchedulingDetails)
		);
}
