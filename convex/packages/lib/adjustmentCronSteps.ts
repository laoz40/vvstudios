import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	evaluatePackageAdjustment,
	insertNoChargePackageAdjustment,
	insertPackageAdjustmentInvoice,
	lookupPackageAdjustmentByPackageId,
	type PackageAdjustmentSession
} from "#convex/packages/lib/adjustments";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	scheduleCompletedPackageAdjustmentCheck,
	scheduleExpiredPackageAdjustmentCheck
} from "#convex/packages/lib/adjustmentJobs";
import { logError } from "#convex/shared/lib/logger";

type ReadyPackageAdjustment = Extract<
	ReturnType<typeof evaluatePackageAdjustment>,
	{ kind: "ready" }
>;

type PackageAdjustmentRecordPlan =
	| { kind: "record"; evaluation: ReadyPackageAdjustment }
	| { kind: "skip"; nextCheckAt: number | null };

type PackageAdjustmentSessions = {
	packageRecord: Doc<"packages">;
	bookings: PackageAdjustmentSession[];
};

export function hasAdjustableStatus(packageRecord: Doc<"packages"> | null) {
	return packageRecord?.status === "paid" || packageRecord?.status === "schedule_email_failed";
}

export function keepExpiredAdjustablePackage(
	args: { expectedExpiresAt: number },
	now: number,
	record: Doc<"packages"> | null
) {
	return hasAdjustableStatus(record) &&
		record?.expiresAt === args.expectedExpiresAt &&
		now >= args.expectedExpiresAt
		? record
		: null;
}

export function keepCompletedAdjustablePackage(record: Doc<"packages"> | null) {
	return hasAdjustableStatus(record) ? record : null;
}

export function keepCompletedPackageSessions(sessions: PackageAdjustmentSessions | null) {
	return sessions && sessions.bookings.length === sessions.packageRecord.packageSize
		? sessions
		: null;
}

export type RecordAdjustmentArgs = {
	packageId: Id<"packages">;
	trigger: Doc<"packageAdjustments">["trigger"];
	createdAt: number;
};

export function loadPackageWithoutAdjustment(
	ctx: MutationCtx,
	packageRecord: Doc<"packages"> | null
) {
	if (packageRecord === null) return okAsync(null);

	return lookupPackageAdjustmentByPackageId(ctx, packageRecord._id).map((adjustment) =>
		adjustment ? null : packageRecord
	);
}

export function loadPackageAdjustmentSessions(
	ctx: MutationCtx,
	packageRecord: Doc<"packages"> | null
) {
	if (packageRecord === null) return okAsync(null);

	return getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
		(bookings) => ({ packageRecord, bookings })
	);
}

export function preparePackageAdjustment(
	evaluation: ReturnType<typeof evaluatePackageAdjustment> | null,
	packageId: Id<"packages">
): PackageAdjustmentRecordPlan {
	if (evaluation === null) {
		return { kind: "skip", nextCheckAt: null };
	}

	if (evaluation.kind === "wait_for_sessions_to_end") {
		return { kind: "skip", nextCheckAt: evaluation.nextCheckAt };
	}

	if (evaluation.kind === "invalid_duration") {
		logError({ operation: "packages.evaluateAdjustment", packageId, reason: "INVALID_DURATION" });

		return { kind: "skip", nextCheckAt: null };
	}

	return { kind: "record", evaluation };
}

export function deferExpiredAdjustment(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	next: number | null
) {
	return next === null ? okAsync(null) : scheduleExpiredPackageAdjustmentCheck(ctx, args, next);
}

export function deferCompletedAdjustment(
	ctx: MutationCtx,
	id: Id<"packages">,
	next: number | null
) {
	return next === null ? okAsync(null) : scheduleCompletedPackageAdjustmentCheck(ctx, id, next);
}

export function evaluateLoadedPackageAdjustment(
	sessions: PackageAdjustmentSessions | null,
	createdAt: number
) {
	if (sessions === null) return null;

	return evaluatePackageAdjustment(sessions.bookings, createdAt);
}

export function insertPlannedPackageAdjustment(
	ctx: MutationCtx,
	args: RecordAdjustmentArgs,
	plan: PackageAdjustmentRecordPlan
): ResultAsync<
	{ adjustmentId: Id<"packageAdjustments"> | null; nextCheckAt: number | null },
	never
> {
	if (plan.kind === "skip") {
		return okAsync({ adjustmentId: null, nextCheckAt: plan.nextCheckAt });
	}

	if (plan.evaluation.quantity === 0) {
		return insertNoChargePackageAdjustment(ctx, args).map(() => ({
			adjustmentId: null,
			nextCheckAt: null
		}));
	}

	return insertPackageAdjustmentInvoice(ctx, args, plan.evaluation).map((adjustmentId) => ({
		adjustmentId,
		nextCheckAt: null
	}));
}
