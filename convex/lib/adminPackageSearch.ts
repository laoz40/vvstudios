import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { exhaustiveCheck } from "#/lib/result";
import {
	paginateAdminPackagesByCreatedAt,
	passesAdminPackageStaleFilter,
	type AdminPackageListSortDirection,
	type AdminPackagesView
} from "#convex/lib/adminPackageList";
import type { ParsedAdminSearchQuery } from "#convex/lib/adminSearchQuery";
import { adminPartialFieldSearchArgs } from "#convex/lib/adminSearchPrefixFilters";
import { normalizeAbn, normalizePhone } from "#convex/lib/contactNormalization";
import {
	emptyAdminSearchListPage,
	paginateAdminPackagesBlobSearch,
	paginateAdminPackagesFieldSearch,
	paginateAdminSearchList,
	type AdminSearchListPage
} from "#convex/lib/adminSearchPagination";

type AdminPackagePaginationOpts = { numItems: number; cursor: string | null };

export type AdminPackageSearchArgs = {
	sortDirection: AdminPackageListSortDirection;
	view: AdminPackagesView;
	includeStale: boolean;
	paginationOpts: AdminPackagePaginationOpts;
	parsedQuery: ParsedAdminSearchQuery;
};

type AdminPackageSearchPage = AdminSearchListPage<Doc<"packages">>;

function isVisiblePackageMatch(
	packageRecord: Doc<"packages">,
	view: AdminPackagesView,
	includeStale: boolean
) {
	if (view === "inbox" && packageRecord.archived) {
		return false;
	}

	return passesAdminPackageStaleFilter(packageRecord, includeStale);
}

function includePackageRow(args: Pick<AdminPackageSearchArgs, "view" | "includeStale">) {
	return (packageRecord: Doc<"packages">) =>
		isVisiblePackageMatch(packageRecord, args.view, args.includeStale);
}

async function paginatePackagesByEmail(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs,
	email: string
): Promise<AdminPackageSearchPage> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_email", (indexQuery) => indexQuery.eq("email", email))
				.paginate({ cursor, numItems }),
		includeRow: includePackageRow(args)
	});
}

async function paginatePackagesByReceipt(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs,
	receiptNumber: string
): Promise<AdminPackageSearchPage> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_receiptNumber", (indexQuery) =>
					indexQuery.eq("receiptNumber", receiptNumber)
				)
				.paginate({ cursor, numItems }),
		includeRow: includePackageRow(args)
	});
}

async function paginatePackagesByPhone(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs,
	phoneQuery: string
): Promise<AdminPackageSearchPage> {
	const phoneNormalized = normalizePhone(phoneQuery);

	if (phoneNormalized.length === 0) {
		return emptyAdminSearchListPage();
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_phone", (indexQuery) => indexQuery.eq("phone", phoneNormalized))
				.paginate({ cursor, numItems }),
		includeRow: includePackageRow(args)
	});
}

async function paginatePackagesByAbn(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs,
	abnQuery: string
): Promise<AdminPackageSearchPage> {
	const normalizedAbn = normalizeAbn(abnQuery);

	if (normalizedAbn.length === 0) {
		return emptyAdminSearchListPage();
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_abn", (indexQuery) => indexQuery.eq("abn", normalizedAbn))
				.paginate({ cursor, numItems }),
		includeRow: includePackageRow(args)
	});
}

async function paginateAdminPackagesByPrefixQuery(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs,
	parsedQuery: Exclude<
		ParsedAdminSearchQuery,
		{ kind: "blob" } | { kind: "editor" } | { kind: "date" }
	>
): Promise<AdminPackageSearchPage> {
	switch (parsedQuery.kind) {
		case "email":
			return paginatePackagesByEmail(ctx, args, parsedQuery.value);
		case "receipt":
			return paginatePackagesByReceipt(ctx, args, parsedQuery.value);
		case "phone":
			return paginatePackagesByPhone(ctx, args, parsedQuery.value);
		case "abn":
			return paginatePackagesByAbn(ctx, args, parsedQuery.value);
		case "name":
		case "account":
		case "ig": {
			const fieldSearch = adminPartialFieldSearchArgs(parsedQuery);

			return paginateAdminPackagesFieldSearch(ctx, {
				...fieldSearch,
				view: args.view,
				includeStale: args.includeStale,
				paginationOpts: args.paginationOpts
			});
		}

		default:
			return exhaustiveCheck(parsedQuery);
	}
}

export async function paginateAdminPackagesWithSearch(
	ctx: QueryCtx,
	args: AdminPackageSearchArgs
): Promise<AdminPackageSearchPage> {
	const { parsedQuery } = args;

	if (parsedQuery.kind === "editor" || parsedQuery.kind === "date") {
		return emptyAdminSearchListPage();
	}

	if (parsedQuery.kind === "blob") {
		if (parsedQuery.text.length === 0) {
			return emptyAdminSearchListPage();
		}

		return paginateAdminPackagesBlobSearch(ctx, {
			searchText: parsedQuery.text,
			view: args.view,
			includeStale: args.includeStale,
			paginationOpts: args.paginationOpts
		});
	}

	return paginateAdminPackagesByPrefixQuery(ctx, args, parsedQuery);
}

export function paginateAdminPackagesWithoutSearch(
	ctx: QueryCtx,
	args: Omit<AdminPackageSearchArgs, "parsedQuery">
) {
	return paginateAdminPackagesByCreatedAt(ctx, args.view, args.sortDirection, args.paginationOpts);
}
