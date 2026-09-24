import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";

export type AdminPackagesView = "inbox" | "all";

export type AdminPackageListSortDirection = "asc" | "desc";

type AdminPackagePaginationOpts = { numItems: number; cursor: string | null };

export function paginateAdminPackagesByCreatedAt(
	ctx: QueryCtx,
	view: AdminPackagesView,
	sortDirection: AdminPackageListSortDirection,
	paginationOpts: AdminPackagePaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("packages")
			.withIndex("by_hiddenAt_and_createdAt", (query) => query.eq("hiddenAt", undefined))
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("packages")
		.withIndex("by_createdAt")
		.order(sortDirection)
		.paginate(paginationOpts);
}

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function isStalePackage(packageRecord: Pick<Doc<"packages">, "createdAt" | "status">, now: number) {
	if (packageRecord.status === "expired" || packageRecord.status === "abandoned") {
		return true;
	}

	return (
		packageRecord.status === "pending_payment" &&
		packageRecord.createdAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
}

export function passesAdminPackageStaleFilter(
	packageRecord: Doc<"packages">,
	includeStale: boolean,
	now = Date.now()
) {
	if (includeStale) {
		return true;
	}

	return !isStalePackage(packageRecord, now);
}
