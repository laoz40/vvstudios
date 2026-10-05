import { okAsync, ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { isPackageArchived, setPackageArchived } from "#convex/lib/archiveState";
import { lookupPackageAdjustmentByPackageId } from "#convex/lib/packages/packageAdjustments";
import {
	isPackageEligibleForAutoArchive,
	type PackageAdjustmentArchiveState
} from "#convex/lib/packages/packageArchive";
import { lookupPackageRow } from "#convex/lib/packages/packageLookup";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/lib/stripe/stripeInvoices";

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

function buildPackageAutoArchiveContext(packageRecord: Doc<"packages">) {
	return ([sessions, adjustment, stripeInvoices]: [
		Doc<"bookings">[],
		Doc<"packageAdjustments"> | null,
		Doc<"stripeInvoices">[]
	]) => ({
		packageRecord,
		sessions,
		adjustment: toPackageAdjustmentArchiveState(adjustment),
		customStripeSummary: summarizeCustomPackageStripeInvoices(stripeInvoices)
	});
}

function loadPackageAutoArchiveContextForRow(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages">
) {
	return (packageRecord: Doc<"packages"> | null) => {
		if (!packageRecord) {
			return okAsync(null);
		}

		return ResultAsync.combine([
			getCapacityConsumingPackageSessions(ctx, packageId, packageRecord.packageSize),
			lookupPackageAdjustmentByPackageId(ctx, packageId),
			listStripeInvoicesForPackage(ctx, packageId)
		]).map(buildPackageAutoArchiveContext(packageRecord));
	};
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
	return lookupPackageRow(ctx, packageId).andThen(
		loadPackageAutoArchiveContextForRow(ctx, packageId)
	);
}

function archivePackageWhenEligible(ctx: MutationCtx, packageId: Id<"packages">, now: number) {
	return (
		context: {
			packageRecord: Doc<"packages">;
			sessions: Doc<"bookings">[];
			adjustment: PackageAdjustmentArchiveState | null;
			customStripeSummary: ReturnType<typeof summarizeCustomPackageStripeInvoices>;
		} | null
	) => {
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

		return setPackageArchived(ctx, packageId, true);
	};
}

export function archivePackageWhenFullyDone(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	now = Date.now()
) {
	return loadPackageAutoArchiveContext(ctx, packageId).andThen(
		archivePackageWhenEligible(ctx, packageId, now)
	);
}
