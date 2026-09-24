import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	evaluatePackageAdjustment,
	type PackageAdjustmentSession
} from "#convex/lib/packageAdjustments";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packageScheduling";
import {
	isPackageArchived,
	packageArchivedPatch,
	setPackageArchived
} from "#convex/lib/archiveState";
import { okOrThrow } from "#convex/lib/result";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices,
	type StripeInvoiceAmountSummary
} from "#convex/lib/stripeInvoices";

export const DEAD_PACKAGE_STATUSES = ["expired", "abandoned"] as const;

export type DeadPackageStatus = (typeof DEAD_PACKAGE_STATUSES)[number];

export function isDeadPackageStatus(
	status: Doc<"packages">["status"]
): status is DeadPackageStatus {
	return status === "expired" || status === "abandoned";
}

export function archiveDeadPackage(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	updates: Partial<Doc<"packages">>,
	now = Date.now()
): ResultAsync<null, never> {
	const merged: Partial<Doc<"packages">> = { ...updates };

	if (updates.status !== undefined && isDeadPackageStatus(updates.status)) {
		Object.assign(merged, packageArchivedPatch(merged.hiddenAt ?? now));
	}

	return okOrThrow(ctx.db.patch(packageId, merged).then(() => null));
}

function isPackageWindowClosed(
	packageRecord: Pick<Doc<"packages">, "expiresAt" | "packageSize">,
	sessions: PackageAdjustmentSession[],
	now: number
) {
	if (packageRecord.expiresAt !== undefined && now >= packageRecord.expiresAt) {
		return true;
	}

	if (sessions.length < packageRecord.packageSize) {
		return false;
	}

	const evaluation = evaluatePackageAdjustment(sessions, now);

	if (evaluation.kind === "wait_for_sessions_to_end") {
		return false;
	}

	if (evaluation.kind === "invalid_duration") {
		return false;
	}

	return true;
}

type PackageAdjustmentArchiveState =
	| { outcome: "no_charge" }
	| { outcome: "invoice_required"; paymentStatus: "paid" | "unpaid" };

function isPackageAdjustmentResolved(adjustment: PackageAdjustmentArchiveState | null) {
	if (!adjustment) {
		return false;
	}

	if (adjustment.outcome === "no_charge") {
		return true;
	}

	return adjustment.paymentStatus === "paid";
}

function toPackageAdjustmentArchiveState(
	adjustment: Doc<"packageAdjustments"> | null
): PackageAdjustmentArchiveState | null {
	if (!adjustment) {
		return null;
	}

	if (adjustment.outcome === "no_charge") {
		return { outcome: "no_charge" };
	}

	return { outcome: "invoice_required", paymentStatus: adjustment.paymentStatus };
}

export function isPackageEligibleForAutoArchive(
	packageRecord: Pick<Doc<"packages">, "status" | "expiresAt" | "packageSize">,
	sessions: PackageAdjustmentSession[],
	adjustment: PackageAdjustmentArchiveState | null,
	customStripeSummary: StripeInvoiceAmountSummary | null,
	now = Date.now()
) {
	if (packageRecord.status !== "paid") {
		return false;
	}

	if (!isPackageWindowClosed(packageRecord, sessions, now)) {
		return false;
	}

	if (!isPackageAdjustmentResolved(adjustment)) {
		return false;
	}

	if (customStripeSummary?.paymentStatus === "unpaid") {
		return false;
	}

	return true;
}

async function loadPackageAutoArchiveContext(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">
) {
	const packageRecord = await ctx.db.get(packageId);

	if (!packageRecord) {
		return null;
	}

	const [sessions, adjustment, stripeInvoices] = await Promise.all([
		getCapacityConsumingPackageSessions(ctx, packageId, packageRecord.packageSize),
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageId))
			.unique(),
		listStripeInvoicesForPackage(ctx, packageId)
	]);

	const customStripeSummary = stripeInvoices.isOk()
		? summarizeCustomPackageStripeInvoices(stripeInvoices.value)
		: null;

	return {
		packageRecord,
		sessions,
		adjustment: toPackageAdjustmentArchiveState(adjustment),
		customStripeSummary
	};
}

export function archivePackageWhenFullyDone(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	now = Date.now()
): ResultAsync<null, never> {
	return okOrThrow(loadPackageAutoArchiveContext(ctx, packageId)).andThen((context) => {
		if (!context) {
			return okAsync(null);
		}

		const { packageRecord, sessions, adjustment, customStripeSummary } = context;

		if (isPackageArchived(packageRecord)) {
			return okAsync(null);
		}

		if (
			!isPackageEligibleForAutoArchive(
				packageRecord,
				sessions,
				adjustment,
				customStripeSummary,
				now
			)
		) {
			return okAsync(null);
		}

		return okOrThrow(setPackageArchived(ctx, packageId, true, now).then(() => null));
	});
}

/** Puts a paid package back in the admin inbox when a new unpaid invoice needs attention. */
export function unarchivePackageForNewUnpaidInvoice(
	ctx: MutationCtx,
	packageRecord: Doc<"packages">
): ResultAsync<null, never> {
	if (!isPackageArchived(packageRecord)) {
		return okAsync(null);
	}

	if (packageRecord.status !== "paid") {
		return okAsync(null);
	}

	return okOrThrow(setPackageArchived(ctx, packageRecord._id, false).then(() => null));
}
