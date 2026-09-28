import type { PaginationResult } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { passesAdminPackageStaleFilter } from "#convex/lib/adminPackageList";
import { passesAdminInboxStaleFilter } from "#convex/lib/adminSessionList";
import type {
	AdminBookingPartialFieldSearchArgs,
	AdminPackagePartialFieldSearchArgs
} from "#convex/lib/adminSearchPrefixFilters";

export type AdminArchivedListView = "inbox" | "all";

export type AdminSearchListPage<T> = {
	continueCursor: string;
	isDone: boolean;
	page: T[];
	splitCursor?: string | null;
	pageStatus?: "SplitRecommended" | "SplitRequired" | null;
	refineSearch?: boolean;
};

type AdminBlobSearchPaginationOpts = { numItems: number; cursor: string | null };

export type AdminBlobSearchIndexArgs = {
	searchText: string;
	view: AdminArchivedListView;
	paginationOpts: AdminBlobSearchPaginationOpts;
};

export type AdminBookingFieldSearchIndexArgs = AdminBookingPartialFieldSearchArgs &
	AdminBlobSearchIndexArgs;

export type AdminPackageFieldSearchIndexArgs = AdminPackagePartialFieldSearchArgs &
	AdminBlobSearchIndexArgs;

function includeBookingRow(args: { view: AdminArchivedListView; includeStale: boolean }) {
	return (session: Doc<"bookings">) => {
		if (args.view === "inbox" && session.archived) {
			return false;
		}

		return passesAdminInboxStaleFilter(session, args.includeStale);
	};
}

function includePackageRow(args: { view: AdminArchivedListView; includeStale: boolean }) {
	return (packageRecord: Doc<"packages">) => {
		if (args.view === "inbox" && packageRecord.archived) {
			return false;
		}

		return passesAdminPackageStaleFilter(packageRecord, args.includeStale);
	};
}

type AdminSearchPageFetcher<T> = (
	cursor: string | null,
	numItems: number
) => Promise<PaginationResult<T>>;

export function emptyAdminSearchListPage<T>(): AdminSearchListPage<T> {
	return { continueCursor: "", isDone: true, page: [], refineSearch: false };
}

export async function paginateAdminSearchList<T extends Doc<"bookings"> | Doc<"packages">>(args: {
	paginationOpts: AdminBlobSearchPaginationOpts;
	fetchPage: AdminSearchPageFetcher<T>;
	includeRow: (record: T) => boolean;
}): Promise<AdminSearchListPage<T>> {
	const { paginationOpts } = args;
	const dbPage = await args.fetchPage(paginationOpts.cursor, paginationOpts.numItems);
	const page = dbPage.page.filter(args.includeRow);

	const refineSearch = paginationOpts.cursor === null ? !dbPage.isDone : false;

	return { continueCursor: dbPage.continueCursor, isDone: dbPage.isDone, page, refineSearch };
}

function adminBookingsBlobSearchQuery(
	ctx: QueryCtx,
	args: Pick<AdminBlobSearchIndexArgs, "searchText" | "view">
) {
	return ctx.db.query("bookings").withSearchIndex("search_admin_blob", (indexQuery) => {
		const searchQuery = indexQuery.search("searchBlob", args.searchText);

		if (args.view === "inbox") {
			return searchQuery.eq("archived", false);
		}

		return searchQuery;
	});
}

export async function paginateAdminBookingsBlobSearchIndex(
	ctx: QueryCtx,
	args: AdminBlobSearchIndexArgs
): Promise<PaginationResult<Doc<"bookings">>> {
	return adminBookingsBlobSearchQuery(ctx, args).paginate(args.paginationOpts);
}

function adminBookingsFieldSearchQuery(
	ctx: QueryCtx,
	args: Pick<AdminBookingFieldSearchIndexArgs, "indexName" | "searchField" | "searchText" | "view">
) {
	if (args.indexName === "search_admin_editor") {
		return ctx.db.query("bookings").withSearchIndex("search_admin_editor", (indexQuery) => {
			const searchQuery = indexQuery.search("assignedEditorDisplayName", args.searchText);

			if (args.view === "inbox") {
				return searchQuery.eq("archived", false);
			}

			return searchQuery;
		});
	}

	const fieldArgs = args as AdminPackagePartialFieldSearchArgs & {
		view: AdminArchivedListView;
	};

	return ctx.db.query("bookings").withSearchIndex(fieldArgs.indexName, (indexQuery) => {
		const searchQuery = indexQuery.search(fieldArgs.searchField, fieldArgs.searchText);

		if (fieldArgs.view === "inbox") {
			return searchQuery.eq("archived", false);
		}

		return searchQuery;
	});
}

export async function paginateAdminBookingsFieldSearchIndex(
	ctx: QueryCtx,
	args: AdminBookingFieldSearchIndexArgs
): Promise<PaginationResult<Doc<"bookings">>> {
	return adminBookingsFieldSearchQuery(ctx, args).paginate(args.paginationOpts);
}

function adminPackagesFieldSearchQuery(
	ctx: QueryCtx,
	args: Pick<AdminPackageFieldSearchIndexArgs, "indexName" | "searchField" | "searchText" | "view">
) {
	return ctx.db.query("packages").withSearchIndex(args.indexName, (indexQuery) => {
		const searchQuery = indexQuery.search(args.searchField, args.searchText);

		if (args.view === "inbox") {
			return searchQuery.eq("archived", false);
		}

		return searchQuery;
	});
}

export async function paginateAdminPackagesFieldSearchIndex(
	ctx: QueryCtx,
	args: AdminPackageFieldSearchIndexArgs
): Promise<PaginationResult<Doc<"packages">>> {
	return adminPackagesFieldSearchQuery(ctx, args).paginate(args.paginationOpts);
}

export async function paginateAdminBookingsFieldSearch(
	ctx: QueryCtx,
	args: AdminBookingFieldSearchIndexArgs & { includeStale: boolean }
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			paginateAdminBookingsFieldSearchIndex(ctx, { ...args, paginationOpts: { cursor, numItems } }),
		includeRow: includeBookingRow(args)
	});
}

export async function paginateAdminPackagesFieldSearch(
	ctx: QueryCtx,
	args: AdminPackageFieldSearchIndexArgs & { includeStale: boolean }
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			paginateAdminPackagesFieldSearchIndex(ctx, { ...args, paginationOpts: { cursor, numItems } }),
		includeRow: includePackageRow(args)
	});
}

function adminPackagesBlobSearchQuery(
	ctx: QueryCtx,
	args: Pick<AdminBlobSearchIndexArgs, "searchText" | "view">
) {
	return ctx.db.query("packages").withSearchIndex("search_admin_blob", (indexQuery) => {
		const searchQuery = indexQuery.search("searchBlob", args.searchText);

		if (args.view === "inbox") {
			return searchQuery.eq("archived", false);
		}

		return searchQuery;
	});
}

export async function paginateAdminPackagesBlobSearchIndex(
	ctx: QueryCtx,
	args: AdminBlobSearchIndexArgs
): Promise<PaginationResult<Doc<"packages">>> {
	return adminPackagesBlobSearchQuery(ctx, args).paginate(args.paginationOpts);
}

export async function paginateAdminBookingsBlobSearch(
	ctx: QueryCtx,
	args: AdminBlobSearchIndexArgs & { includeStale: boolean }
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			paginateAdminBookingsBlobSearchIndex(ctx, {
				searchText: args.searchText,
				view: args.view,
				paginationOpts: { cursor, numItems }
			}),
		includeRow: includeBookingRow(args)
	});
}

export async function paginateAdminPackagesBlobSearch(
	ctx: QueryCtx,
	args: AdminBlobSearchIndexArgs & { includeStale: boolean }
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			paginateAdminPackagesBlobSearchIndex(ctx, {
				searchText: args.searchText,
				view: args.view,
				paginationOpts: { cursor, numItems }
			}),
		includeRow: includePackageRow(args)
	});
}
