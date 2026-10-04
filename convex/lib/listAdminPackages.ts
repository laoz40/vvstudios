import { tryPromise } from "#convex/lib/result";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { exhaustiveCheck } from "#/lib/result";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/lib/stripe/stripeInvoices";
import { normalizeAbn, normalizePhone } from "#convex/lib/contactNormalization";
import {
	adminPartialFieldSearchArgs,
	type AdminPackagePartialFieldSearchArgs
} from "#convex/lib/adminSearch/adminSearchPrefixFilters";
import {
	parseTrimmedAdminSearchQuery,
	type ParsedAdminSearchQuery
} from "#convex/lib/adminSearch/adminSearchQuery";
import {
	emptyAdminSearchListPage,
	paginateAdminSearchList,
	type AdminArchivedListView,
	type AdminSearchListPage
} from "#convex/lib/adminSearch/adminListSearchPage";

export type AdminPackagesView = AdminArchivedListView;

export type AdminPackageListSortDirection = "asc" | "desc";

type AdminPackagePaginationOpts = { numItems: number; cursor: string | null };

export type ListAdminPackagesArgs = {
	sortDirection?: AdminPackageListSortDirection;
	view?: AdminPackagesView;
	includeStale?: boolean;
	paginationOpts: AdminPackagePaginationOpts;
	searchQuery?: string;
};

type AdminPackageSearchContext = {
	sortDirection: AdminPackageListSortDirection;
	view: AdminPackagesView;
	includeStale: boolean;
	paginationOpts: AdminPackagePaginationOpts;
};

type AdminBlobSearchIndexArgs = {
	searchText: string;
	view: AdminArchivedListView;
	paginationOpts: AdminPackagePaginationOpts;
};

type AdminPackageFieldSearchIndexArgs = AdminPackagePartialFieldSearchArgs &
	AdminBlobSearchIndexArgs;

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

function passesAdminPackageStaleFilter(
	packageRecord: Doc<"packages">,
	includeStale: boolean,
	now = Date.now()
) {
	if (includeStale) {
		return true;
	}

	return !isStalePackage(packageRecord, now);
}

function passesAdminPackageListRow(
	packageRecord: Doc<"packages">,
	view: AdminPackagesView,
	includeStale: boolean
) {
	if (view === "inbox" && packageRecord.archived) {
		return false;
	}

	return passesAdminPackageStaleFilter(packageRecord, includeStale);
}

function applyAdminPackageListVisibility(
	packages: Doc<"packages">[],
	view: AdminPackagesView,
	includeStale: boolean
) {
	return packages.filter((packageRecord) =>
		passesAdminPackageListRow(packageRecord, view, includeStale)
	);
}

function paginateAdminPackagesByCreatedAt(
	ctx: QueryCtx,
	view: AdminPackagesView,
	sortDirection: AdminPackageListSortDirection,
	paginationOpts: AdminPackagePaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("packages")
			.withIndex("by_archived_and_createdAt", (query) => query.eq("archived", false))
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("packages")
		.withIndex("by_createdAt")
		.order(sortDirection)
		.paginate(paginationOpts);
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

async function paginateAdminPackagesFieldSearch(
	ctx: QueryCtx,
	args: AdminPackageFieldSearchIndexArgs
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			adminPackagesFieldSearchQuery(ctx, {
				indexName: args.indexName,
				searchField: args.searchField,
				searchText: args.searchText,
				view: args.view
			}).paginate({ cursor, numItems })
	});
}

async function paginateAdminPackagesBlobSearch(ctx: QueryCtx, args: AdminBlobSearchIndexArgs) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			adminPackagesBlobSearchQuery(ctx, { searchText: args.searchText, view: args.view }).paginate({
				cursor,
				numItems
			})
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

async function paginatePackagesByEmail(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	email: string
): Promise<AdminSearchListPage<Doc<"packages">>> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_email", (indexQuery) => indexQuery.eq("email", email))
				.paginate({ cursor, numItems })
	});
}

async function paginatePackagesByReceipt(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	receiptNumber: string
): Promise<AdminSearchListPage<Doc<"packages">>> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_receiptNumber", (indexQuery) =>
					indexQuery.eq("receiptNumber", receiptNumber)
				)
				.paginate({ cursor, numItems })
	});
}

async function paginatePackagesByPhone(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	phoneQuery: string
): Promise<AdminSearchListPage<Doc<"packages">>> {
	const canonicalPhone = normalizePhone(phoneQuery);

	if (canonicalPhone.length === 0) {
		return emptyAdminSearchListPage();
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("packages")
				.withIndex("by_phone", (indexQuery) => indexQuery.eq("phone", canonicalPhone))
				.paginate({ cursor, numItems })
	});
}

async function paginatePackagesByAbn(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	abnQuery: string
): Promise<AdminSearchListPage<Doc<"packages">>> {
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
				.paginate({ cursor, numItems })
	});
}

async function paginateAdminPackagesByPrefixQuery(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	parsedQuery: Exclude<
		ParsedAdminSearchQuery,
		{ kind: "blob" } | { kind: "editor" } | { kind: "date" }
	>
): Promise<AdminSearchListPage<Doc<"packages">>> {
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
				paginationOpts: args.paginationOpts
			});
		}

		default:
			return exhaustiveCheck(parsedQuery);
	}
}

async function paginateAdminPackagesWithSearch(
	ctx: QueryCtx,
	args: AdminPackageSearchContext & { parsedQuery: ParsedAdminSearchQuery }
): Promise<AdminSearchListPage<Doc<"packages">>> {
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
			paginationOpts: args.paginationOpts
		});
	}

	return paginateAdminPackagesByPrefixQuery(ctx, args, parsedQuery);
}

async function paginateAdminPackagesWithoutSearch(
	ctx: QueryCtx,
	args: AdminPackageSearchContext
): Promise<AdminSearchListPage<Doc<"packages">>> {
	const { sortDirection, view, paginationOpts } = args;

	const packagesPage = await paginateAdminPackagesByCreatedAt(
		ctx,
		view,
		sortDirection,
		paginationOpts
	);

	return {
		continueCursor: packagesPage.continueCursor,
		isDone: packagesPage.isDone,
		page: packagesPage.page,
		refineSearch: false
	};
}

async function loadAdminPackageListRows(ctx: QueryCtx, packagesOnPage: Doc<"packages">[]) {
	return Promise.all(
		packagesOnPage.map(async (packageFromDb) => {
			const [packageSessionsResult, packageAdjustment, stripeInvoicesResult] = await Promise.all([
				getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize),
				ctx.db
					.query("packageAdjustments")
					.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageFromDb._id))
					.unique(),
				listStripeInvoicesForPackage(ctx, packageFromDb._id)
			]);

			if (packageSessionsResult.isErr()) {
				throw new Error("getCapacityConsumingPackageSessions failed");
			}

			const packageSessions = packageSessionsResult.value;

			const customStripeInvoicesSummary = summarizeCustomPackageStripeInvoices(
				stripeInvoicesResult.unwrapOr([])
			);

			return {
				...packageFromDb,
				bookedSessions: packageSessions.length,
				areSessionsComplete: packageAdjustment !== null,
				adjustment:
					packageAdjustment?.outcome === "invoice_required"
						? {
								_id: packageAdjustment._id,
								totalAmount: packageAdjustment.totalAmount,
								invoiceDueAt: packageAdjustment.invoiceDueAt,
								invoiceEmailStatus: packageAdjustment.invoiceEmailStatus,
								paymentStatus: packageAdjustment.paymentStatus
							}
						: null,
				customStripeInvoicesSummary
			};
		})
	);
}

async function fetchAdminPackagesListPage(
	ctx: QueryCtx,
	args: ListAdminPackagesArgs
): Promise<AdminSearchListPage<Doc<"packages">>> {
	const sortDirection = args.sortDirection ?? "desc";
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? false;
	const parsedSearchQuery = parseTrimmedAdminSearchQuery(args.searchQuery);

	const searchContext: AdminPackageSearchContext = {
		sortDirection,
		view,
		includeStale,
		paginationOpts: args.paginationOpts
	};

	return parsedSearchQuery
		? paginateAdminPackagesWithSearch(ctx, { ...searchContext, parsedQuery: parsedSearchQuery })
		: paginateAdminPackagesWithoutSearch(ctx, searchContext);
}

async function fetchListAdminPackages(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? false;

	const packagesPage = await fetchAdminPackagesListPage(ctx, args);

	const visiblePackages = applyAdminPackageListVisibility(packagesPage.page, view, includeStale);

	const page = await loadAdminPackageListRows(ctx, visiblePackages);

	return { ...packagesPage, page };
}

export function listAdminPackages(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	return tryPromise({
		try: () => fetchListAdminPackages(ctx, args),
		catch: (cause): never => {
			throw cause;
		}
	});
}
