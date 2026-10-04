import { err, ok, type Result, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { createPackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";
import type { PaidPackageResult } from "#convex/lib/packages/packagePayment";
import { searchBlobPatchForPackage } from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";
import { resolvePackageReceiptNumber } from "#studio/features/booking-invoice/lib/receipt-number";

export type PackageSchedulingDetails = Awaited<ReturnType<typeof createPackageSchedulingDetails>>;

export function rejectAlreadyPaidPackage(
	packageFromDb: Doc<"packages">
): Result<Doc<"packages">, { reason: "PACKAGE_ALREADY_PAID" }> {
	if (packageFromDb.status === "paid" || packageFromDb.status === "schedule_email_failed") {
		return err({ reason: "PACKAGE_ALREADY_PAID" });
	}

	return ok(packageFromDb);
}

export function persistPackagePaidLifecycle(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	paidAt: number,
	packageSchedulingDetails: PackageSchedulingDetails
): ResultAsync<PackageSchedulingDetails, never> {
	return okOrThrow(
		(async () => {
			const packageFromDb = packageSchedulingDetails.packageFromDb;

			const paidLifecyclePatch = {
				expiresAt: packageSchedulingDetails.expiresAt,
				paidAt,
				packageReminderState: undefined,
				scheduleLinkStatus: "active" as const,
				scheduleTokenHash: packageSchedulingDetails.scheduleTokenHash,
				status: "schedule_email_failed" as const
			};

			if (packageFromDb.receiptNumber) {
				await ctx.db.patch("packages", packageId, paidLifecyclePatch);

				return packageSchedulingDetails;
			}

			const receiptNumber = resolvePackageReceiptNumber(packageFromDb, paidAt);

			const searchBlobPatch = searchBlobPatchForPackage(packageFromDb, { receiptNumber });

			await ctx.db.patch("packages", packageId, {
				...paidLifecyclePatch,
				receiptNumber,
				...searchBlobPatch
			});

			return packageSchedulingDetails;
		})()
	);
}

export function schedulePackageAdjustmentAtExpiry(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	expiresAt: number
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler
			.runAt(expiresAt, internal.packageScheduling.processPackageAdjustmentAtExpiry, {
				packageId,
				expectedExpiresAt: expiresAt
			})
			.then(() => null)
	);
}

export function buildPaidPackageResult(
	packageSchedulingDetails: PackageSchedulingDetails,
	paidAt: number
): PaidPackageResult {
	const packageFromDb = packageSchedulingDetails.packageFromDb;
	const receiptNumber = resolvePackageReceiptNumber(packageFromDb, paidAt);

	return {
		expiresAt: packageSchedulingDetails.expiresAt,
		paidAt,
		packageRecord: {
			...packageFromDb,
			expiresAt: packageSchedulingDetails.expiresAt,
			paidAt,
			receiptNumber,
			scheduleLinkStatus: "active",
			scheduleTokenHash: packageSchedulingDetails.scheduleTokenHash,
			status: "schedule_email_failed"
		},
		token: packageSchedulingDetails.token
	};
}
