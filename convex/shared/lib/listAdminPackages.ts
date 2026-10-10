import { okAsync, ResultAsync, type ResultAsync as ResultAsyncType } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { exhaustiveCheck } from "#/lib/result";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/packageScheduling";
import {
	calculatePaidAmount,
	listStripeInvoicesForBookings,
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/stripe/lib/stripeInvoices";
import { normalizeAbn, normalizePhone } from "#convex/shared/lib/contactNormalization";
import {
	adminPartialFieldSearchArgs,
	type AdminPackagePartialFieldSearchArgs
} from "#convex/shared/lib/adminSearch/adminSearchPrefixFilters";
import {
	parseTrimmedAdminSearchQuery,
	type ParsedAdminSearchQuery
} from "#convex/shared/lib/adminSearch/adminSearchQuery";
import {
	emptyAdminSearchListPage,
	type AdminArchivedListView,
	type AdminSearchListPage
} from "#convex/shared/lib/adminSearch/adminListSearchPage";

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

function mapAdminPackageSearchPage<T>(
	paginationOpts: AdminPackagePaginationOpts,
	dbPage: { continueCursor: string; isDone: boolean; page: T[] }
): AdminSearchListPage<T> {
	return {
		continueCursor: dbPage.continueCursor,
		isDone: dbPage.isDone,
		page: dbPage.page,
		refineSearch: paginationOpts.cursor === null ? !dbPage.isDone : false
	};
}

function paginateAdminPackagesFieldSearch(ctx: QueryCtx, args: AdminPackageFieldSearchIndexArgs) {
	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withSearchIndex(args.indexName, (indexQuery) => {
				const searchQuery = indexQuery.search(args.searchField, args.searchText);

				if (args.view === "inbox") {
					return searchQuery.eq("archived", false);
				}

				return searchQuery;
			})
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginateAdminPackagesBlobSearch(ctx: QueryCtx, args: AdminBlobSearchIndexArgs) {
	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withSearchIndex("search_admin_blob", (indexQuery) => {
				const searchQuery = indexQuery.search("searchBlob", args.searchText);

				if (args.view === "inbox") {
					return searchQuery.eq("archived", false);
				}

				return searchQuery;
			})
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginatePackagesByEmail(ctx: QueryCtx, args: AdminPackageSearchContext, email: string) {
	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withIndex("by_email", (indexQuery) => indexQuery.eq("email", email))
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginatePackagesByReceipt(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	receiptNumber: string
) {
	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withIndex("by_receiptNumber", (indexQuery) => indexQuery.eq("receiptNumber", receiptNumber))
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginatePackagesByPhone(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	phoneQuery: string
) {
	const canonicalPhone = normalizePhone(phoneQuery);

	if (canonicalPhone.length === 0) {
		return okAsync(emptyAdminSearchListPage<Doc<"packages">>());
	}

	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withIndex("by_phone", (indexQuery) => indexQuery.eq("phone", canonicalPhone))
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginatePackagesByAbn(ctx: QueryCtx, args: AdminPackageSearchContext, abnQuery: string) {
	const normalizedAbn = normalizeAbn(abnQuery);

	if (normalizedAbn.length === 0) {
		return okAsync(emptyAdminSearchListPage<Doc<"packages">>());
	}

	const { paginationOpts } = args;

	return okOrThrow(
		ctx.db
			.query("packages")
			.withIndex("by_abn", (indexQuery) => indexQuery.eq("abn", normalizedAbn))
			.paginate({ cursor: paginationOpts.cursor, numItems: paginationOpts.numItems })
	).map((dbPage) => mapAdminPackageSearchPage(paginationOpts, dbPage));
}

function paginateAdminPackagesByPrefixQuery(
	ctx: QueryCtx,
	args: AdminPackageSearchContext,
	parsedQuery: Exclude<
		ParsedAdminSearchQuery,
		{ kind: "blob" } | { kind: "editor" } | { kind: "date" }
	>
) {
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

function paginateAdminPackagesWithSearch(
	ctx: QueryCtx,
	args: AdminPackageSearchContext & { parsedQuery: ParsedAdminSearchQuery }
): ResultAsyncType<AdminSearchListPage<Doc<"packages">>, never> {
	const { parsedQuery } = args;

	if (parsedQuery.kind === "editor" || parsedQuery.kind === "date") {
		return okAsync(emptyAdminSearchListPage<Doc<"packages">>());
	}

	if (parsedQuery.kind === "blob") {
		if (parsedQuery.text.length === 0) {
			return okAsync(emptyAdminSearchListPage<Doc<"packages">>());
		}

		return paginateAdminPackagesBlobSearch(ctx, {
			searchText: parsedQuery.text,
			view: args.view,
			paginationOpts: args.paginationOpts
		});
	}

	return paginateAdminPackagesByPrefixQuery(ctx, args, parsedQuery);
}

function paginateAdminPackagesWithoutSearch(ctx: QueryCtx, args: AdminPackageSearchContext) {
	const { sortDirection, view, paginationOpts } = args;

	if (view === "inbox") {
		return okOrThrow(
			ctx.db
				.query("packages")
				.withIndex("by_archived_and_createdAt", (query) => query.eq("archived", false))
				.order(sortDirection)
				.paginate(paginationOpts)
		).map((packagesPage) => ({
			continueCursor: packagesPage.continueCursor,
			isDone: packagesPage.isDone,
			page: packagesPage.page,
			refineSearch: false
		}));
	}

	return okOrThrow(
		ctx.db.query("packages").withIndex("by_createdAt").order(sortDirection).paginate(paginationOpts)
	).map((packagesPage) => ({
		continueCursor: packagesPage.continueCursor,
		isDone: packagesPage.isDone,
		page: packagesPage.page,
		refineSearch: false
	}));
}

function loadAdminPackageListRow(ctx: QueryCtx, packageFromDb: Doc<"packages">) {
	return okOrThrow(
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageFromDb._id))
			.unique()
	).andThen((packageAdjustment) =>
		getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize).andThen(
			(packageSessions) =>
				ResultAsync.combine([
					listStripeInvoicesForPackage(ctx, packageFromDb._id),
					listStripeInvoicesForBookings(
						ctx,
						packageSessions.map((booking) => booking._id)
					)
				]).map(([stripeInvoices, sessionInvoices]) => {
					const customStripeInvoicesSummary = summarizeCustomPackageStripeInvoices(stripeInvoices);

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
						paidAmount: calculatePaidAmount({
							originalPaidAmount: packageFromDb.originalPaidAmount ?? null,
							invoices: [...stripeInvoices, ...sessionInvoices]
						}),
						customStripeInvoicesSummary
					};
				})
		)
	);
}

function loadAdminPackageListRows(ctx: QueryCtx, packagesOnPage: Doc<"packages">[]) {
	return ResultAsync.combine(
		packagesOnPage.map((packageFromDb) => loadAdminPackageListRow(ctx, packageFromDb))
	);
}

function fetchAdminPackagesListPage(
	ctx: QueryCtx,
	args: ListAdminPackagesArgs
): ResultAsyncType<AdminSearchListPage<Doc<"packages">>, never> {
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

export function listAdminPackages(ctx: QueryCtx, args: ListAdminPackagesArgs) {
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? false;

	return fetchAdminPackagesListPage(ctx, args).andThen((packagesPage) => {
		const visiblePackages = applyAdminPackageListVisibility(packagesPage.page, view, includeStale);

		return loadAdminPackageListRows(ctx, visiblePackages).map((page) => ({
			...packagesPage,
			page
		}));
	});
}
