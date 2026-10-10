import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export function schedulePackageAdjustmentWhenSessionsComplete(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler
			.runAfter(
				0,
				internal.packages.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
				{ packageId }
			)
			.then(() => null)
	);
}
