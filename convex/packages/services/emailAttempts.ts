import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { syncPackageBookingsReceiptNumber } from "#convex/packages/services/bookingsReceiptSync";
import {
	buildPackageReceiptEmailAttemptPatch,
	packageReceiptNumberForSync,
	selectPackageReceiptSyncId,
	patchPackageReceiptEmailAttempt,
	patchPackageScheduleEmailStatus
} from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

type PackageReceiptEmailAttemptArgs = {
	packageId: Id<"packages">;
	status: "sent" | "failed";
	receiptNumber?: string;
};

function patchReceiptEmailForPackage(
	ctx: MutationCtx,
	args: PackageReceiptEmailAttemptArgs & { failureCode?: string },
	packageFromDb: Doc<"packages">
) {
	return patchPackageReceiptEmailAttempt(
		ctx,
		args.packageId,
		buildPackageReceiptEmailAttemptPatch(packageFromDb, args, Date.now())
	).andThen(() =>
		syncPackageBookingsReceiptNumber(
			ctx,
			selectPackageReceiptSyncId(args),
			packageReceiptNumberForSync(args)
		)
	);
}

export function writePackageScheduleEmailAttempt(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		patchPackageScheduleEmailStatus(ctx, args.packageId, args.status)
	);
}

export function writePackageReceiptEmailAttempt(
	ctx: MutationCtx,
	args: PackageReceiptEmailAttemptArgs & { failureCode?: string }
) {
	return getPackageFromDb(ctx, args.packageId).andThen((packageFromDb) =>
		patchReceiptEmailForPackage(ctx, args, packageFromDb)
	);
}
