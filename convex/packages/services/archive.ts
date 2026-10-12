import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	archivePackageWhenEligible,
	loadPackageForAutoArchive,
	loadPackageAutoArchiveContextForRow
} from "#convex/packages/lib/archive";

function loadPackageAutoArchiveContext(
	ctx: QueryCtx | MutationCtx,
	packageId: Id<"packages"> | null
) {
	return safeTry(async function* () {
		const packageRecord = yield* loadPackageForAutoArchive(ctx, packageId);

		const archiveContext = yield* loadPackageAutoArchiveContextForRow(
			ctx,
			packageId,
			packageRecord
		);

		return ok(archiveContext);
	});
}

export function archivePackageWhenFullyDone(
	ctx: MutationCtx,
	packageId: Id<"packages"> | null,
	now = Date.now()
) {
	return safeTry(async function* () {
		const archiveContext = yield* loadPackageAutoArchiveContext(ctx, packageId);
		const archived = yield* archivePackageWhenEligible(ctx, packageId, now, archiveContext);

		return ok(archived);
	});
}
