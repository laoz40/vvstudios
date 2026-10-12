import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
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
) {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, args.packageId);
		const unpaidPackage = yield* rejectAlreadyPaidPackage(packageRecord);
		const schedulingDetails = yield* createPackageSchedulingDetails(unpaidPackage, args.paidAt);

		const paidPackage = yield* patchPackagePaidAfterSchedulingDetails(
			ctx,
			args.packageId,
			args.paidAt,
			schedulingDetails
		);

		yield* schedulePackageAdjustmentAtExpiry(ctx, args.packageId, paidPackage.expiresAt);

		return ok(buildPaidPackageResult(paidPackage, args.paidAt));
	});
}
