import type { ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	archivePackageWhenEligible,
	loadPackageForAutoArchive,
	loadPackageAutoArchiveContextForRow,
	type PackageAutoArchiveContext
} from "#convex/packages/lib/archive";

function loadPackageAutoArchiveContext(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages"> | null
) {
	return loadPackageForAutoArchive(ctx, packageId).andThen((packageRecord) =>
		loadPackageAutoArchiveContextForRow(ctx, packageId, packageRecord)
	);
}

export function archivePackageWhenFullyDone(
	ctx: MutationCtx,
	packageId: Id<"packages"> | null,
	now = Date.now()
): NeverthrowResultAsync<null, never> {
	return loadPackageAutoArchiveContext(ctx, packageId).andThen(
		(context: PackageAutoArchiveContext | null) =>
			archivePackageWhenEligible(ctx, packageId, now, context)
	);
}
