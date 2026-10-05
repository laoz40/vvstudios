import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { processPackageAdjustment } from "#convex/lib/packages/packageAdjustments";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";

export async function runPackageAdjustmentWhenExpired(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}

export async function runPackageAdjustmentWhenAllSessionsBooked(
	ctx: MutationCtx,
	args: { packageId: Id<"packages"> }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}
