import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	evaluatePackageAdjustment,
	type PackageAdjustmentSession
} from "#convex/packages/lib/adjustments";
import {
	isPackageArchived,
	packageArchivedPatch,
	setPackageArchived
} from "#convex/shared/lib/archiveState";
import { okOrThrow } from "#convex/shared/lib/result";
import type { StripeInvoiceAmountSummary } from "#convex/stripe/lib/invoices";

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
	updates: Partial<Doc<"packages">>
): ResultAsync<null, never> {
	const merged: Partial<Doc<"packages">> = { ...updates };

	if (updates.status !== undefined && isDeadPackageStatus(updates.status)) {
		Object.assign(merged, packageArchivedPatch());
	}

	return okOrThrow(ctx.db.patch("packages", packageId, merged).then(() => null));
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

export type PackageAdjustmentArchiveState =
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

	return setPackageArchived(ctx, packageRecord._id, false);
}
