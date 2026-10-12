import { ok, safeTry } from "neverthrow";
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
) {
	return safeTry(async function* () {
		const packageRow = yield* lookupPackageRow(ctx, args.packageId);
		const expiredPackage = keepExpiredAdjustablePackage(args, now, packageRow);
		const packageRecord = yield* loadPackageWithoutAdjustment(ctx, expiredPackage);
		const sessions = yield* loadPackageAdjustmentSessions(ctx, packageRecord);

		return ok(sessions);
	});
}

export function loadCompletedPackageAdjustmentSessions(
	ctx: MutationCtx,
	packageId: Id<"packages">
) {
	return safeTry(async function* () {
		const packageRow = yield* lookupPackageRow(ctx, packageId);
		const completedPackage = keepCompletedAdjustablePackage(packageRow);
		const packageRecord = yield* loadPackageWithoutAdjustment(ctx, completedPackage);
		const sessions = yield* loadPackageAdjustmentSessions(ctx, packageRecord);

		return ok(keepCompletedPackageSessions(sessions));
	});
}

export function recordPackageAdjustment(
	ctx: MutationCtx,
	args: RecordAdjustmentArgs,
	sessions: PackageAdjustmentSessions | null
) {
	const evaluation = evaluateLoadedPackageAdjustment(sessions, args.createdAt);
	const plan = preparePackageAdjustment(evaluation, args.packageId);

	return safeTry(async function* () {
		const plannedAdjustment = yield* insertPlannedPackageAdjustment(ctx, args, plan);

		const adjustmentId = yield* patchPackageAdjustmentInvoiceNumber(
			ctx,
			plannedAdjustment.adjustmentId,
			args.createdAt
		);

		yield* schedulePackageAdjustmentInvoice(ctx, adjustmentId);

		return ok(plannedAdjustment.nextCheckAt);
	});
}

export function deferExpiredPackageAdjustment(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	nextCheckAt: number | null
) {
	return deferExpiredAdjustment(ctx, args, nextCheckAt);
}

export function deferCompletedPackageAdjustment(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	nextCheckAt: number | null
) {
	return deferCompletedAdjustment(ctx, packageId, nextCheckAt);
}
