import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { QueryCtx } from "#convex/_generated/server";
import {
	evaluatePackageAdjustment,
	lookupPackageAdjustmentByPackageId,
	type PackageAdjustmentSession
} from "#convex/packages/lib/adjustments";
import { lookupPackageRow } from "#convex/packages/lib/lookup";
import { setPackageArchived } from "#convex/shared/lib/archiveState";
import { okOrThrow } from "#convex/shared/lib/result";
import type { StripeInvoiceAmountSummary } from "#convex/stripe/lib/invoices";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/stripe/lib/invoices";

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
		Object.assign(merged, { archived: true });
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

export type PackageAutoArchiveContext = {
	packageRecord: Doc<"packages">;
	sessions: Doc<"bookings">[];
	adjustment: PackageAdjustmentArchiveState | null;
	customStripeSummary: ReturnType<typeof summarizeCustomPackageStripeInvoices>;
};

export function toPackageAdjustmentArchiveState(
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

export function buildPackageAutoArchiveContext(
	packageRecord: Doc<"packages">,
	[sessions, adjustment, stripeInvoices]: [
		Doc<"bookings">[],
		Doc<"packageAdjustments"> | null,
		Doc<"stripeInvoices">[]
	]
): PackageAutoArchiveContext {
	return {
		packageRecord,
		sessions,
		adjustment: toPackageAdjustmentArchiveState(adjustment),
		customStripeSummary: summarizeCustomPackageStripeInvoices(stripeInvoices)
	};
}

export function loadPackageAutoArchiveContextForRow(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages"> | null,
	packageRecord: Doc<"packages"> | null
): ResultAsync<PackageAutoArchiveContext | null, never> {
	if (!packageRecord || packageId === null) {
		return okAsync(null);
	}

	return ResultAsync.combine([
		getCapacityConsumingPackageSessions(ctx, packageId, packageRecord.packageSize),
		lookupPackageAdjustmentByPackageId(ctx, packageId),
		listStripeInvoicesForPackage(ctx, packageId)
	]).map((values) => buildPackageAutoArchiveContext(packageRecord, values));
}

export function archivePackageWhenEligible(
	ctx: MutationCtx,
	packageId: Id<"packages"> | null,
	now: number,
	context: PackageAutoArchiveContext | null
) {
	if (!context || packageId === null) {
		return okAsync(null);
	}

	const { packageRecord, sessions, adjustment, customStripeSummary } = context;

	if (
		packageRecord.archived ||
		!isPackageEligibleForAutoArchive(packageRecord, sessions, adjustment, customStripeSummary, now)
	) {
		return okAsync(null);
	}

	return setPackageArchived(ctx, packageId, true);
}

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
	packageRecord: Doc<"packages"> | null
): ResultAsync<null, never> {
	if (packageRecord === null) return okAsync(null);

	if (!packageRecord.archived) {
		return okAsync(null);
	}

	if (packageRecord.status !== "paid") {
		return okAsync(null);
	}

	return setPackageArchived(ctx, packageRecord._id, false);
}

export function loadPackageForAutoArchive(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages"> | null
) {
	if (packageId === null) return okAsync(null);

	return lookupPackageRow(ctx, packageId);
}
