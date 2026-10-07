import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "#convex/_generated/server";
import { listAdminPackages } from "#convex/lib/listAdminPackages";
import { requirePermission } from "#convex/services/auth";

type ListAdminPackagesArgs = {
	paginationOpts: PaginationOptions;
	sortDirection?: "asc" | "desc";
	view?: "inbox" | "all";
	includeStale?: boolean;
	searchQuery?: string;
};

export function listAdminPackagesPage(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return requirePermission(ctx, "view:packages").andThen(() => listAdminPackages(ctx, args));
}
