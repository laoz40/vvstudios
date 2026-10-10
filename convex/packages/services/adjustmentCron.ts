import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	evaluatePackageAdjustment,
	insertNoChargePackageAdjustment,
	insertPackageAdjustmentInvoice,
	lookupPackageAdjustmentByPackageId,
	patchPackageAdjustmentInvoiceNumber,
	type PackageAdjustmentSession
} from "#convex/packages/lib/adjustments";
import {
	scheduleCompletedPackageAdjustmentCheck,
	scheduleExpiredPackageAdjustmentCheck,
	schedulePackageAdjustmentInvoice
} from "#convex/packages/lib/adjustmentJobs";
import { lookupPackageRow } from "#convex/packages/lib/lookup";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";

type PackageAdjustmentSessions = {
	packageRecord: Doc<"packages">;
	bookings: PackageAdjustmentSession[];
};

function hasAdjustableStatus(packageRecord: Doc<"packages"> | null) {
	return packageRecord?.status === "paid" || packageRecord?.status === "schedule_email_failed";
}

function loadSessionsWithoutAdjustment(
	ctx: MutationCtx,
	packageRecord: Doc<"packages">,
	adjustment: Doc<"packageAdjustments"> | null
) {
	if (adjustment) return okAsync(null);

	return getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
		(bookings) => ({ packageRecord, bookings })
	);
}

function loadUnadjustedPackageSessions(ctx: MutationCtx, packageRecord: Doc<"packages"> | null) {
	if (!packageRecord) return okAsync(null);

	return lookupPackageAdjustmentByPackageId(ctx, packageRecord._id).andThen((adjustment) =>
		loadSessionsWithoutAdjustment(ctx, packageRecord, adjustment)
	);
}

export function loadExpiredPackageAdjustmentSessions(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	now: number
): ResultAsync<PackageAdjustmentSessions | null, never> {
	return lookupPackageRow(ctx, args.packageId)
		.map((packageRecord) =>
			hasAdjustableStatus(packageRecord) &&
			packageRecord?.expiresAt === args.expectedExpiresAt &&
			now >= args.expectedExpiresAt
				? packageRecord
				: null
		)
		.andThen((packageRecord) => loadUnadjustedPackageSessions(ctx, packageRecord));
}

export function loadCompletedPackageAdjustmentSessions(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<PackageAdjustmentSessions | null, never> {
	return lookupPackageRow(ctx, packageId)
		.map((packageRecord) => (hasAdjustableStatus(packageRecord) ? packageRecord : null))
		.andThen((packageRecord) => loadUnadjustedPackageSessions(ctx, packageRecord))
		.map((sessions) =>
			sessions && sessions.bookings.length === sessions.packageRecord.packageSize ? sessions : null
		);
}

export function recordPackageAdjustment(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		trigger: Doc<"packageAdjustments">["trigger"];
		createdAt: number;
	},
	sessions: PackageAdjustmentSessions | null
): ResultAsync<number | null, never> {
	if (!sessions) return okAsync(null);

	const evaluation = evaluatePackageAdjustment(sessions.bookings, args.createdAt);

	switch (evaluation.kind) {
		case "wait_for_sessions_to_end":
			return okAsync(evaluation.nextCheckAt);
		case "invalid_duration":
			console.error("Package adjustment could not parse a session duration", {
				packageId: args.packageId
			});

			return okAsync(null);
		case "ready":
			if (evaluation.quantity === 0) return insertNoChargePackageAdjustment(ctx, args);

			return insertPackageAdjustmentInvoice(ctx, args, evaluation)
				.andThen((adjustmentId) =>
					patchPackageAdjustmentInvoiceNumber(ctx, adjustmentId, args.createdAt)
				)
				.andThen((adjustmentId) => schedulePackageAdjustmentInvoice(ctx, adjustmentId));
		default: {
			const exhaustive: never = evaluation;

			return exhaustive;
		}
	}
}

export function deferExpiredPackageAdjustment(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; expectedExpiresAt: number },
	nextCheckAt: number | null
): ResultAsync<null, never> {
	if (nextCheckAt === null) return okAsync(null);

	return scheduleExpiredPackageAdjustmentCheck(ctx, args, nextCheckAt);
}

export function deferCompletedPackageAdjustment(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	nextCheckAt: number | null
): ResultAsync<null, never> {
	if (nextCheckAt === null) return okAsync(null);

	return scheduleCompletedPackageAdjustmentCheck(ctx, packageId, nextCheckAt);
}
