import { err, ok, type Result, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { PackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";
import type { PaidPackageResult } from "#convex/lib/packages/packagePayment";
import { searchBlobPatchForPackage } from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";
import { resolvePackageReceiptNumber } from "#studio/features/booking-invoice/lib/receipt-number";

export type { PackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";

export function rejectAlreadyPaidPackage(
	packageFromDb: Doc<"packages">
): Result<Doc<"packages">, { reason: "PACKAGE_ALREADY_PAID" }> {
	if (packageFromDb.status === "paid" || packageFromDb.status === "schedule_email_failed") {
		return err({ reason: "PACKAGE_ALREADY_PAID" });
	}

	return ok(packageFromDb);
}

export type PackagePaidLifecyclePatch = {
	expiresAt: number;
	paidAt: number;
	packageReminderState: undefined;
	scheduleLinkStatus: "active";
	scheduleTokenHash: string;
	status: "schedule_email_failed";
	receiptNumber?: string;
	searchBlob?: string;
};

export function buildPackagePaidLifecyclePatch(
	packageFromDb: Doc<"packages">,
	paidAt: number,
	packageSchedulingDetails: PackageSchedulingDetails
): PackagePaidLifecyclePatch {
	const paidLifecyclePatch: PackagePaidLifecyclePatch = {
		expiresAt: packageSchedulingDetails.expiresAt,
		paidAt,
		packageReminderState: undefined,
		scheduleLinkStatus: "active",
		scheduleTokenHash: packageSchedulingDetails.scheduleTokenHash,
		status: "schedule_email_failed"
	};

	if (packageFromDb.receiptNumber) {
		return paidLifecyclePatch;
	}

	const receiptNumber = resolvePackageReceiptNumber(packageFromDb, paidAt);
	const searchBlobPatch = searchBlobPatchForPackage(packageFromDb, { receiptNumber });

	return { ...paidLifecyclePatch, receiptNumber, ...searchBlobPatch };
}

export function patchPackagePaidLifecycle(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	patch: PackagePaidLifecyclePatch
): ResultAsync<null, never> {
	return okOrThrow(ctx.db.patch("packages", packageId, patch).then(() => null));
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
