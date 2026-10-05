import { ok, ResultAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	patchPackageSessionBookingsContactSearch,
	searchBlobPatchForPackage
} from "#convex/lib/adminSearch/adminSearchBlob";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import { patchPackageBookingsReceiptNumber } from "#convex/lib/packages/packageBookingsReceiptSync";
import { validateActivePackageForInstagramUpdate } from "#convex/lib/packages/packageCheckout";
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
	type PackageSchedulingDetails,
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

function createSchedulingDetailsForPaidAt(paidAt: number, packageFromDb: Doc<"packages">) {
	return createPackageSchedulingDetails(packageFromDb, paidAt);
}

function patchPaidPackageAfterSchedulingDetails(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number },

	packageSchedulingDetails: PackageSchedulingDetails
) {
	return patchPackagePaidAfterSchedulingDetails(
		ctx,
		args.packageId,
		args.paidAt,
		packageSchedulingDetails
	);
}

function scheduleAdjustmentAndKeepSchedulingDetails(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	packageSchedulingDetails: PackageSchedulingDetails
) {
	return schedulePackageAdjustmentAtExpiry(ctx, packageId, packageSchedulingDetails.expiresAt).map(
		() => keepValue(packageSchedulingDetails)
	);
}

function keepValue<T>(value: T) {
	return value;
}

function buildPaidPackageResultForPaidAt(
	paidAt: number,
	packageSchedulingDetails: Parameters<typeof buildPaidPackageResult>[0]
) {
	return buildPaidPackageResult(packageSchedulingDetails, paidAt);
}

export function markPackagePaidWithScheduleToken(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; paidAt: number }
): ResultAsyncType<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(rejectAlreadyPaidPackage)
		.andThen((packageFromDb: Doc<"packages">) =>
			createSchedulingDetailsForPaidAt(args.paidAt, packageFromDb)
		)
		.andThen((packageSchedulingDetails: PackageSchedulingDetails) =>
			patchPaidPackageAfterSchedulingDetails(ctx, args, packageSchedulingDetails)
		)
		.andThen((packageSchedulingDetails: PackageSchedulingDetails) =>
			scheduleAdjustmentAndKeepSchedulingDetails(ctx, args.packageId, packageSchedulingDetails)
		)
		.map((packageSchedulingDetails: Parameters<typeof buildPaidPackageResult>[0]) =>
			buildPaidPackageResultForPaidAt(args.paidAt, packageSchedulingDetails)
		);
}

function attachScheduleTokenToPackage(
	packageFromDb: Doc<"packages">,
	scheduleToken: { scheduleTokenHash: string; token: string }
) {
	return { packageFromDb, ...scheduleToken };
}

function createScheduleTokenForPackage(packageFromDb: Doc<"packages">) {
	return createPackageScheduleToken().map(
		(scheduleToken: { scheduleTokenHash: string; token: string }) =>
			attachScheduleTokenToPackage(packageFromDb, scheduleToken)
	);
}

function refreshScheduleTokenForPackage(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	{
		packageFromDb,
		scheduleTokenHash,
		token
	}: { packageFromDb: Doc<"packages">; scheduleTokenHash: string; token: string }
) {
	return patchPackageScheduleTokenRefresh(ctx, packageId, scheduleTokenHash).map(() =>
		refreshedScheduleTokenResultForPackage(packageFromDb, scheduleTokenHash, token)
	);
}

function refreshedScheduleTokenResultForPackage(
	packageFromDb: Doc<"packages">,
	scheduleTokenHash: string,
	token: string
) {
	return {
		expiresAt: packageFromDb.expiresAt!,
		paidAt: packageFromDb.paidAt!,
		packageRecord: { ...packageFromDb, scheduleLinkStatus: "active" as const, scheduleTokenHash },
		token
	} satisfies PaidPackageResult;
}

export function refreshPaidPackageScheduleToken(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen(createScheduleTokenForPackage)
		.andThen((_value) => refreshScheduleTokenForPackage(ctx, packageId, _value));
}

function patchPackageScheduleEmailForArgs(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return patchPackageScheduleEmailStatus(ctx, args.packageId, args.status);
}

export function writePackageScheduleEmailAttempt(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		patchPackageScheduleEmailForArgs(ctx, args)
	);
}

function afterReceiptEmailPatch(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed"; receiptNumber?: string }
) {
	if (args.status !== "sent" || !args.receiptNumber) {
		return ok(null);
	}

	return patchPackageBookingsReceiptNumber(ctx, args.packageId, args.receiptNumber);
}

function patchReceiptEmailForPackage(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		status: "sent" | "failed";
		receiptNumber?: string;
		failureCode?: string;
	},

	packageFromDb: Doc<"packages">
) {
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

	return patchPackageReceiptEmailAttempt(ctx, args.packageId, sentPatch).andThen(() =>
		afterReceiptEmailPatch(ctx, args)
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
	return getPackageFromDb(ctx, args.packageId).andThen((packageFromDb: Doc<"packages">) =>
		patchReceiptEmailForPackage(ctx, args, packageFromDb)
	);
}

export function loadPackageEligibleForInstagramUpdate(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId).andThen(validateActivePackageForInstagramUpdate);
}

function syncInstagramContactSearch(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	contactFields: PackageContactSearchFields
) {
	return ResultAsync.fromSafePromise(
		patchPackageSessionBookingsContactSearch(ctx, packageId, contactFields)
	).map(() => null);
}

type PackageContactSearchFields = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	instagramHandle: string;
};

function syncInstagramContactSearchAfterPatch(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	contactFields: PackageContactSearchFields
) {
	return syncInstagramContactSearch(ctx, packageId, contactFields);
}

export function savePackageInstagramHandle(
	ctx: MutationCtx,
	args: { packageFromDb: Doc<"packages">; instagramHandle: string }
) {
	const contactFields: PackageContactSearchFields = {
		name: args.packageFromDb.name,
		phone: args.packageFromDb.phone,
		accountName: args.packageFromDb.accountName,
		abn: args.packageFromDb.abn,
		email: args.packageFromDb.email,
		instagramHandle: args.instagramHandle
	};

	return patchPackageRowInstagramHandle(ctx, args).andThen(() =>
		syncInstagramContactSearchAfterPatch(ctx, args.packageFromDb._id, contactFields)
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
