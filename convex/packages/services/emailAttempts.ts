import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		yield* patchPackageReceiptEmailAttempt(
			ctx,
			args.packageId,
			buildPackageReceiptEmailAttemptPatch(packageFromDb, args, Date.now())
		);

		const syncedBookings = yield* syncPackageBookingsReceiptNumber(
			ctx,
			selectPackageReceiptSyncId(args),
			packageReceiptNumberForSync(args)
		);

		return ok(syncedBookings);
	});
}

export function writePackageScheduleEmailAttempt(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return safeTry(async function* () {
		yield* getPackageFromDb(ctx, args.packageId);
		const updated = yield* patchPackageScheduleEmailStatus(ctx, args.packageId, args.status);

		return ok(updated);
	});
}

export function writePackageReceiptEmailAttempt(
	ctx: MutationCtx,
	args: PackageReceiptEmailAttemptArgs & { failureCode?: string }
) {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, args.packageId);
		const updated = yield* patchReceiptEmailForPackage(ctx, args, packageRecord);

		return ok(updated);
	});
}
