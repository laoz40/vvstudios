import type { PaginationOptions } from "convex/server";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import {
	buildPendingPackageRecord,
	type CreatePendingPackageArgs
} from "#convex/lib/packages/packageUpdates";
import { listAdminPackages, type AdminPackagesView } from "#convex/lib/listAdminPackages";

export type { PackageLookupError } from "#convex/lib/packages/packageLookup";

export type { PaidPackageResult } from "#convex/lib/packages/packagePayment";

export function createPendingPackageService(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();

	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return ctx.db
		.insert("packages", packageRecord)
		.then((packageId) => ({ packageRecord: { _id: packageId, ...packageRecord } }));
}

type PackageListSortDirection = "asc" | "desc";

type ListPackagesArgs = {
	paginationOpts: PaginationOptions;
	sortDirection?: PackageListSortDirection;
	view?: AdminPackagesView;
	includeStale?: boolean;
	searchQuery?: string;
};

export function listPackagesService(ctx: QueryCtx, args: ListPackagesArgs) {
	return requirePermission(ctx, "view:packages").andThen(() => listAdminPackages(ctx, args));
}
