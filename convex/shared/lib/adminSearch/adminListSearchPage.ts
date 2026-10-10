import type { PaginationResult } from "convex/server";

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

type AdminSearchPageFetcher<T> = (
	cursor: string | null,
	numItems: number
) => Promise<PaginationResult<T>>;

export function emptyAdminSearchListPage<T>(): AdminSearchListPage<T> {
	return { continueCursor: "", isDone: true, page: [], refineSearch: false };
}

export async function paginateAdminSearchList<T>(args: {
	paginationOpts: AdminBlobSearchPaginationOpts;
	fetchPage: AdminSearchPageFetcher<T>;
}): Promise<AdminSearchListPage<T>> {
	const { paginationOpts } = args;
	const dbPage = await args.fetchPage(paginationOpts.cursor, paginationOpts.numItems);

	const refineSearch = paginationOpts.cursor === null ? !dbPage.isDone : false;

	return {
		continueCursor: dbPage.continueCursor,
		isDone: dbPage.isDone,
		page: dbPage.page,
		refineSearch
	};
}
