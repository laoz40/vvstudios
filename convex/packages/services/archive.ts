import { okAsync, ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { isPackageArchived, setPackageArchived } from "#convex/shared/lib/archiveState";
import { lookupPackageAdjustmentByPackageId } from "#convex/packages/lib/adjustments";
import {
	isPackageEligibleForAutoArchive,
	type PackageAdjustmentArchiveState
} from "#convex/packages/lib/archive";
import { lookupPackageRow } from "#convex/packages/lib/lookup";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/stripe/lib/invoices";

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

function buildPackageAutoArchiveContext(
	packageRecord: Doc<"packages">,
	[sessions, adjustment, stripeInvoices]: [
		Doc<"bookings">[],
		Doc<"packageAdjustments"> | null,
		Doc<"stripeInvoices">[]
	]
) {
	return {
		packageRecord,
		sessions,
		adjustment: toPackageAdjustmentArchiveState(adjustment),
		customStripeSummary: summarizeCustomPackageStripeInvoices(stripeInvoices)
	};
}

function loadPackageAutoArchiveContextForRow(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">,

	packageRecord: Doc<"packages"> | null
) {
	if (!packageRecord) {
		return okAsync(null);
	}

	return ResultAsync.combine([
		getCapacityConsumingPackageSessions(ctx, packageId, packageRecord.packageSize),
		lookupPackageAdjustmentByPackageId(ctx, packageId),
		listStripeInvoicesForPackage(ctx, packageId)
	]).map((_value) => buildPackageAutoArchiveContext(packageRecord, _value));
}

function loadPackageAutoArchiveContext(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">
): NeverthrowResultAsync<
	{
		packageRecord: Doc<"packages">;
		sessions: Doc<"bookings">[];
		adjustment: PackageAdjustmentArchiveState | null;
		customStripeSummary: ReturnType<typeof summarizeCustomPackageStripeInvoices>;
	} | null,
	never
> {
	return lookupPackageRow(ctx, packageId).andThen((packageRecord: Doc<"packages"> | null) =>
		loadPackageAutoArchiveContextForRow(ctx, packageId, packageRecord)
	);
}

function archivePackageWhenEligible(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	now: number,

	context: {
		packageRecord: Doc<"packages">;
		sessions: Doc<"bookings">[];
		adjustment: PackageAdjustmentArchiveState | null;
		customStripeSummary: ReturnType<typeof summarizeCustomPackageStripeInvoices>;
	} | null
) {
	if (!context) {
		return okAsync(null);
	}

	const { packageRecord, sessions, adjustment, customStripeSummary } = context;

	if (isPackageArchived(packageRecord)) {
		return okAsync(null);
	}

	if (
		!isPackageEligibleForAutoArchive(packageRecord, sessions, adjustment, customStripeSummary, now)
	) {
		return okAsync(null);
	}

	return setPackageArchived(ctx, packageId, true);
}

export function archivePackageWhenFullyDone(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	now = Date.now()
) {
	return loadPackageAutoArchiveContext(ctx, packageId).andThen(
		(
			context: {
				packageRecord: Doc<"packages">;
				sessions: Doc<"bookings">[];
				adjustment: PackageAdjustmentArchiveState | null;
				customStripeSummary: ReturnType<typeof summarizeCustomPackageStripeInvoices>;
			} | null
		) => archivePackageWhenEligible(ctx, packageId, now, context)
	);
}
