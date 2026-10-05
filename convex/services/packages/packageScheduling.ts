import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { processPackageAdjustment } from "#convex/lib/packages/packageAdjustments";
import { getValidPackageByToken } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

export function setPackageDefaultSpaceService(
	ctx: MutationCtx,
	args: { service: RecordingSpace; token: string }
) {
	return getValidPackageByToken(ctx, args.token, Date.now()).andThen((packageRecord) =>
		okOrThrow(
			ctx.db
				.patch("packages", packageRecord._id, { defaultSpace: args.service })
				.then(() => ({ defaultSpace: args.service }))
		)
	);
}

export async function processPackageAdjustmentAtExpiryService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "package_expired" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}

export async function processPackageAdjustmentWhenSessionsCompleteService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages"> }
) {
	await processPackageAdjustment(ctx, { ...args, trigger: "all_sessions_completed" });
	await archivePackageWhenFullyDone(ctx, args.packageId);
}
