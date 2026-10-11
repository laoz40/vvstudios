import {
	buildAdminPackageListRow,
	applyAdminPackageListVisibility
} from "#convex/shared/lib/listAdminPackages";
import type { AdminSearchListPage } from "#convex/shared/lib/adminSearch/adminListSearchPage";
import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	fetchAdminPackagesListPage,
	getPackageAdjustment,
	type ListAdminPackagesArgs
} from "#convex/shared/lib/listAdminPackages";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	listStripeInvoicesForBookings,
	listStripeInvoicesForPackage
} from "#convex/stripe/lib/invoices";

function loadAdminPackageListRow(ctx: QueryCtx, packageFromDb: Doc<"packages">) {
	return getPackageAdjustment(ctx, packageFromDb._id).andThen((adjustment) =>
		loadPackageSessionsForRow(ctx, packageFromDb, adjustment)
	);
}

function loadPackageSessionsForRow(
	ctx: QueryCtx,
	packageFromDb: Doc<"packages">,
	adjustment: Doc<"packageAdjustments"> | null
) {
	return getCapacityConsumingPackageSessions(
		ctx,
		packageFromDb._id,
		packageFromDb.packageSize
	).andThen((sessions) => loadPackageInvoicesForRow(ctx, packageFromDb, adjustment, sessions));
}

function loadPackageInvoicesForRow(
	ctx: QueryCtx,
	packageFromDb: Doc<"packages">,
	adjustment: Doc<"packageAdjustments"> | null,
	sessions: Doc<"bookings">[]
) {
	return ResultAsync.combine([
		listStripeInvoicesForPackage(ctx, packageFromDb._id),
		listStripeInvoicesForBookings(
			ctx,
			sessions.map((booking) => booking._id)
		)
	]).map((invoices) => buildAdminPackageListRow(packageFromDb, adjustment, sessions, invoices));
}

function loadAdminPackageListRows(
	ctx: QueryCtx,
	args: ListAdminPackagesArgs,
	packagesPage: AdminSearchListPage<Doc<"packages">>
) {
	const visiblePackages = applyAdminPackageListVisibility(
		packagesPage.page,
		args.view ?? "inbox",
		args.includeStale ?? false
	);

	return ResultAsync.combine(visiblePackages.map((row) => loadAdminPackageListRow(ctx, row))).map(
		(rows) => ({ ...packagesPage, page: rows })
	);
}

export function listAdminPackages(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return fetchAdminPackagesListPage(ctx, args).andThen((page) =>
		loadAdminPackageListRows(ctx, args, page)
	);
}
