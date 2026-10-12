import { ok, safeTry } from "neverthrow";
import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "#convex/_generated/server";
import { listAdminPackages } from "#convex/shared/services/listAdminPackages";
import { requirePermission } from "#convex/shared/services/auth";

type ListAdminPackagesArgs = {
	paginationOpts: PaginationOptions;
	sortDirection?: "asc" | "desc";
	view?: "inbox" | "all";
	includeStale?: boolean;
	searchQuery?: string;
};

export function listAdminPackagesPage(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "view:packages");
		const packagesPage = yield* listAdminPackages(ctx, args);

		return ok(packagesPage);
	});
}
