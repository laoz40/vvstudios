import { err, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	searchBlobPatchForBooking,
	searchBlobPatchForPackage
} from "#convex/lib/adminSearch/adminSearchBlob";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import { getPackageFromDb, type PackageLookupError } from "#convex/lib/packages/packageLookup";
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
	patchPackageInstagramHandle
} from "#convex/lib/packages/packageUpdates";
import { okOrThrow } from "#convex/lib/result";

export function enforcePackageSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function insertPendingPackageRecord(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();

	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return okOrThrow(
		ctx.db
			.insert("packages", packageRecord)
			.then((packageId) => ({ packageRecord: { _id: packageId, ...packageRecord } }))
	);
}

export function markPackagePaidWithScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
): ResultAsync<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
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
			okOrThrow(
				ctx.db
					.patch("packages", packageId, { scheduleLinkStatus: "active", scheduleTokenHash })
					.then(() => ({
						expiresAt: packageFromDb.expiresAt,
						paidAt: packageFromDb.paidAt,
						packageRecord: {
							...packageFromDb,
							scheduleLinkStatus: "active" as const,
							scheduleTokenHash
						},
						token
					}))
			)
		);
}

export function writePackageScheduleEmailAttempt(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("packages", args.packageId, {
					status: args.status === "sent" ? "paid" : "schedule_email_failed"
				})
				.then(() => null)
		)
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

		return okOrThrow(
			ctx.db.patch("packages", args.packageId, sentPatch).then(async () => {
				if (args.status === "sent" && args.receiptNumber) {
					const bookings = await ctx.db
						.query("bookings")
						.withIndex("by_packageId_and_status_and_sessionStartAt", (indexQuery) =>
							indexQuery.eq("packageId", args.packageId)
						)
						.collect();

					await Promise.all(
						bookings.map(async (booking) =>
							ctx.db.patch("bookings", booking._id, {
								receiptNumber: args.receiptNumber,
								...(await searchBlobPatchForBooking(ctx, booking, {
									receiptNumber: args.receiptNumber
								}))
							})
						)
					);
				}

				return null;
			})
		);
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
	return patchPackageInstagramHandle(ctx, args);
}

export function loadPackageRowById(ctx: QueryCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId);
}
