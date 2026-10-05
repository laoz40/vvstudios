import { ConvexError } from "convex/values";
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

function listAdminPackagesForArgs(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return () => listAdminPackages(ctx, args);
}

export function listAdminPackagesPage(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return requirePermission(ctx, "view:packages")
		.andThen(listAdminPackagesForArgs(ctx, args))
		.match(
			(packagesPage) => packagesPage,
			(error) => {
				throw new ConvexError(error);
			}
		);
}
