import {
	buildAdminPackageListRow,
	applyAdminPackageListVisibility
} from "#convex/shared/lib/listAdminPackages";
import type { AdminSearchListPage } from "#convex/shared/lib/adminSearch/adminListSearchPage";
import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const adjustment = yield* getPackageAdjustment(ctx, packageFromDb._id);

		const sessions = yield* getCapacityConsumingPackageSessions(
			ctx,
			packageFromDb._id,
			packageFromDb.packageSize
		);

		const invoices = yield* ResultAsync.combine([
			listStripeInvoicesForPackage(ctx, packageFromDb._id),
			listStripeInvoicesForBookings(
				ctx,
				sessions.map((booking) => booking._id)
			)
		]);

		return ok(buildAdminPackageListRow(packageFromDb, adjustment, sessions, invoices));
	});
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

	return safeTry(async function* () {
		const rows = yield* ResultAsync.combine(
			visiblePackages.map((row) => loadAdminPackageListRow(ctx, row))
		);

		return ok({ ...packagesPage, page: rows });
	});
}

export function listAdminPackages(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return safeTry(async function* () {
		const page = yield* fetchAdminPackagesListPage(ctx, args);
		const rows = yield* loadAdminPackageListRows(ctx, args, page);

		return ok(rows);
	});
}
