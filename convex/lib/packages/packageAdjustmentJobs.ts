import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export function scheduleExpiredPackageAdjustmentCheck(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	nextCheckAt: number
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler.runAt(
			nextCheckAt,
			internal.packageScheduling.processPackageAdjustmentAtExpiry,
			args
		)
	).map(() => null);
}

export function scheduleCompletedPackageAdjustmentCheck(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	nextCheckAt: number
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler.runAt(
			nextCheckAt,
			internal.packageScheduling.processPackageAdjustmentWhenSessionsComplete,
			{ packageId }
		)
	).map(() => null);
}

export function schedulePackageAdjustmentInvoice(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler.runAfter(0, internal.packageAdjustmentInvoices.sendPackageAdjustmentInvoice, {
			adjustmentId,
			attempt: "automatic"
		})
	).map(() => null);
}
