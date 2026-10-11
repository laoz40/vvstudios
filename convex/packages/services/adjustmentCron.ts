import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	patchPackageAdjustmentInvoiceNumber,
	type PackageAdjustmentSession
} from "#convex/packages/lib/adjustments";
import { schedulePackageAdjustmentInvoice } from "#convex/packages/lib/adjustmentJobs";
import { lookupPackageRow } from "#convex/packages/lib/lookup";

import {
	keepExpiredAdjustablePackage,
	keepCompletedAdjustablePackage,
	keepCompletedPackageSessions,
	loadPackageWithoutAdjustment,
	loadPackageAdjustmentSessions,
	preparePackageAdjustment,
	evaluateLoadedPackageAdjustment,
	insertPlannedPackageAdjustment,
	deferExpiredAdjustment,
	deferCompletedAdjustment,
	type RecordAdjustmentArgs
} from "#convex/packages/lib/adjustmentCronSteps";

type PackageAdjustmentSessions = {
	packageRecord: Doc<"packages">;
	bookings: PackageAdjustmentSession[];
};

export function loadExpiredPackageAdjustmentSessions(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	now: number
): ResultAsync<PackageAdjustmentSessions | null, never> {
	return lookupPackageRow(ctx, args.packageId)
		.map((packageRecord) => keepExpiredAdjustablePackage(args, now, packageRecord))
		.andThen((packageRecord) => loadPackageWithoutAdjustment(ctx, packageRecord))
		.andThen((packageRecord) => loadPackageAdjustmentSessions(ctx, packageRecord));
}

export function loadCompletedPackageAdjustmentSessions(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<PackageAdjustmentSessions | null, never> {
	return lookupPackageRow(ctx, packageId)
		.map(keepCompletedAdjustablePackage)
		.andThen((packageRecord) => loadPackageWithoutAdjustment(ctx, packageRecord))
		.andThen((packageRecord) => loadPackageAdjustmentSessions(ctx, packageRecord))
		.map(keepCompletedPackageSessions);
}

export function recordPackageAdjustment(
	ctx: MutationCtx,
	args: RecordAdjustmentArgs,
	sessions: PackageAdjustmentSessions | null
): ResultAsync<number | null, never> {
	const evaluation = evaluateLoadedPackageAdjustment(sessions, args.createdAt);
	const plan = preparePackageAdjustment(evaluation, args.packageId);

	return insertPlannedPackageAdjustment(ctx, args, plan)
		.andThen((result) =>
			patchPackageAdjustmentInvoiceNumber(ctx, result.adjustmentId, args.createdAt).map(
				(adjustmentId) => ({ ...result, adjustmentId })
			)
		)
		.andThen((result) =>
			schedulePackageAdjustmentInvoice(ctx, result.adjustmentId).map(() => result.nextCheckAt)
		);
}

export function deferExpiredPackageAdjustment(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	nextCheckAt: number | null
): ResultAsync<null, never> {
	return deferExpiredAdjustment(ctx, args, nextCheckAt);
}

export function deferCompletedPackageAdjustment(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	nextCheckAt: number | null
): ResultAsync<null, never> {
	return deferCompletedAdjustment(ctx, packageId, nextCheckAt);
}
