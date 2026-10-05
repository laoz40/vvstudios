import { err, ok, ResultAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	patchPackageSessionBookingsContactSearch,
	searchBlobPatchForPackage
} from "#convex/lib/adminSearch/adminSearchBlob";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import { patchPackageBookingsReceiptNumber } from "#convex/lib/packages/packageBookingsReceiptSync";
import type { PackageLookupError } from "#convex/lib/packages/packageLookup";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import type { PaidPackageResult } from "#convex/lib/packages/packagePayment";
import {
	buildPaidPackageResult,
	patchPackagePaidAfterSchedulingDetails,
	rejectAlreadyPaidPackage,
	schedulePackageAdjustmentAtExpiry
} from "#convex/lib/packages/packagePaidLifecycle";
import {
	createPackageScheduleToken,
	createPackageSchedulingDetails,
	validatePackageScheduleTokenRefresh
} from "#convex/lib/packages/packageScheduling";
import {
	buildPendingPackageRecord,
	type CreatePendingPackageArgs,
	insertPendingPackageRow,
	patchPackageReceiptEmailAttempt,
	patchPackageRowInstagramHandle,
	patchPackageScheduleEmailStatus,
	patchPackageScheduleTokenRefresh
} from "#convex/lib/packages/packageUpdates";

export function enforcePackageSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function insertPendingPackageRecord(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();

	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return insertPendingPackageRow(ctx, packageRecord);
}

export function markPackagePaidWithScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
): ResultAsyncType<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(rejectAlreadyPaidPackage)
		.andThen((packageFromDb) => createPackageSchedulingDetails(packageFromDb, args.paidAt))
		.andThen((packageSchedulingDetails) =>
			patchPackagePaidAfterSchedulingDetails(
				ctx,
				args.packageId,
				args.paidAt,
				packageSchedulingDetails
			)
		)
		.andThen((packageSchedulingDetails) =>
			schedulePackageAdjustmentAtExpiry(
				ctx,
				args.packageId,
				packageSchedulingDetails.expiresAt
			).map(() => packageSchedulingDetails)
		)
		.map((packageSchedulingDetails) =>
			buildPaidPackageResult(packageSchedulingDetails, args.paidAt)
		);
}

export function refreshPaidPackageScheduleToken(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen((packageFromDb) =>
			createPackageScheduleToken().map((scheduleToken) => ({ packageFromDb, ...scheduleToken }))
		)
		.andThen(({ packageFromDb, scheduleTokenHash, token }) =>
			patchPackageScheduleTokenRefresh(ctx, packageId, scheduleTokenHash).map(() => ({
				expiresAt: packageFromDb.expiresAt,
				paidAt: packageFromDb.paidAt,
				packageRecord: {
					...packageFromDb,
					scheduleLinkStatus: "active" as const,
					scheduleTokenHash
				},
				token
			}))
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
	args: {
		packageId: Id<"packages">;
		status: "sent" | "failed";
		receiptNumber?: string;
		failureCode?: string;
	}
) {
	return getPackageFromDb(ctx, args.packageId).andThen((packageFromDb) => {
		const now = Date.now();

		const sentPatch =
			args.status === "sent"
				? {
						receiptEmailFailureCode: undefined,
						receiptEmailSentAt: now,
						receiptEmailStatus: "sent" as const,
						receiptNumber: args.receiptNumber,
						lastReceiptEmailAttemptAt: now,
						...searchBlobPatchForPackage(packageFromDb, { receiptNumber: args.receiptNumber })
					}
				: {
						receiptEmailFailureCode: args.failureCode,
						receiptEmailStatus: "failed" as const,
						lastReceiptEmailAttemptAt: now
					};

		return patchPackageReceiptEmailAttempt(ctx, args.packageId, sentPatch).andThen(() => {
			if (args.status !== "sent" || !args.receiptNumber) {
				return ok(null);
			}

			return patchPackageBookingsReceiptNumber(ctx, args.packageId, args.receiptNumber);
		});
	});
}

export function loadPackageEligibleForInstagramUpdate(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId).andThen((packageFromDb) => {
		if (packageFromDb.status !== "pending_payment" && packageFromDb.status !== "paid") {
			return err({ reason: "PACKAGE_NOT_ACTIVE" as const });
		}

		return ok(packageFromDb);
	});
}

export function savePackageInstagramHandle(
	ctx: MutationCtx,
	args: { packageFromDb: Doc<"packages">; instagramHandle: string }
) {
	const contactFields = {
		name: args.packageFromDb.name,
		phone: args.packageFromDb.phone,
		accountName: args.packageFromDb.accountName,
		abn: args.packageFromDb.abn,
		email: args.packageFromDb.email,
		instagramHandle: args.instagramHandle
	};

	return patchPackageRowInstagramHandle(ctx, args).andThen(() =>
		ResultAsync.fromSafePromise(
			patchPackageSessionBookingsContactSearch(ctx, args.packageFromDb._id, contactFields)
		).map(() => null)
	);
}

export async function queryPackageByIdOrNull(
	ctx: QueryCtx,
	packageId: Id<"packages">
): Promise<Doc<"packages"> | null> {
	const packageFromDbResult = await getPackageFromDb(ctx, packageId);

	return packageFromDbResult.match(
		(packageFromDb) => packageFromDb,
		() => null
	);
}
