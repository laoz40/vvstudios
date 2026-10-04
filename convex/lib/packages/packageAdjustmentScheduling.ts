import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export function schedulePackageAdjustmentWhenSessionsComplete(
	ctx: MutationCtx,
	packageId: Id<"packages">
) {
	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete, {
				packageId
			})
			.then(() => null)
	);
}
