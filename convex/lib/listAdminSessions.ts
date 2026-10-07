import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { exhaustiveCheck } from "#/lib/result";
import { env } from "#convex/env";
import {
	getCapacityConsumingPackageSessions,
	sessionConsumesPackageCapacity
} from "#convex/lib/packages/packageScheduling";
import { getDriveWorkflowFailureForBooking } from "#convex/lib/drive/driveStatus";
import {
	calculatePaidAmount,
	listStripeInvoicesForPackage,
	listStripeInvoicesForBookings,
	listStripeInvoicesForBooking,
	summarizeStripeInvoices
} from "#convex/lib/stripe/stripeInvoices";
import { normalizeAbn, normalizePhone } from "#convex/lib/contactNormalization";
import { parseAdminSearchDateValue } from "#convex/lib/adminSearch/adminSearchDateParse";
import {
	adminPartialFieldSearchArgs,
	type AdminBookingPartialFieldSearchArgs
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

export type AdminSessionsView = AdminArchivedListView;

export type AdminSessionListSortDirection = "asc" | "desc";

type AdminSessionPaginationOpts = { numItems: number; cursor: string | null };

type SessionListSortBy = "session" | "createdAt";

export type ListAdminSessionsArgs = {
	sortBy?: SessionListSortBy;
	sortDirection?: AdminSessionListSortDirection;
	view?: AdminSessionsView;
	includeStale?: boolean;
	paginationOpts: AdminSessionPaginationOpts;
	searchQuery?: string;
};

type AdminSessionSearchContext = {
	sortBy: SessionListSortBy;
	sortDirection: AdminSessionListSortDirection;
	view: AdminSessionsView;
	includeStale: boolean;
	paginationOpts: AdminSessionPaginationOpts;
};

type AdminBlobSearchIndexArgs = {
	searchText: string;
	view: AdminArchivedListView;
	paginationOpts: AdminSessionPaginationOpts;
};

type AdminBookingFieldSearchIndexArgs = AdminBookingPartialFieldSearchArgs &
	AdminBlobSearchIndexArgs;

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function isStaleInboxSession(session: Doc<"bookings">, now: number) {
	if (session.status === "expired" || session.status === "abandoned") {
		return true;
	}

	return (
		session.status === "pending_payment" &&
		session.pendingPaymentCreatedAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
}

function passesAdminInboxStaleFilter(
	session: Doc<"bookings">,
	includeStale: boolean,
	now = Date.now()
) {
	if (includeStale) {
		return true;
	}

	if (session.status === "cancelled") {
		return false;
	}

	return !isStaleInboxSession(session, now);
}

function passesAdminSessionListRow(
	session: Doc<"bookings">,
	view: AdminSessionsView,
	includeStale: boolean
) {
	if (view === "inbox" && session.archived) {
		return false;
	}

	return passesAdminInboxStaleFilter(session, includeStale);
}

function applyAdminSessionListVisibility(
	sessions: Doc<"bookings">[],
	view: AdminSessionsView,
	includeStale: boolean
) {
	return sessions.filter((session) => passesAdminSessionListRow(session, view, includeStale));
}

function paginateAdminSessionsBySessionStart(
	ctx: QueryCtx,
	view: AdminSessionsView,
	sortDirection: AdminSessionListSortDirection,
	paginationOpts: AdminSessionPaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("bookings")
			.withIndex("by_archived_and_sessionStartAt", (query) => query.eq("archived", false))
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("bookings")
		.withIndex("by_sessionStartAt")
		.order(sortDirection)
		.paginate(paginationOpts);
}

function paginateAdminSessionsByCreatedAt(
	ctx: QueryCtx,
	view: AdminSessionsView,
	sortDirection: AdminSessionListSortDirection,
	paginationOpts: AdminSessionPaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("bookings")
			.withIndex("by_archived_and_pendingPaymentCreatedAt", (query) => query.eq("archived", false))
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("bookings")
		.withIndex("by_pendingPaymentCreatedAt")
		.order(sortDirection)
		.paginate(paginationOpts);
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

function adminBookingsPackageFieldSearchQuery(
	ctx: QueryCtx,
	args: AdminBookingPartialFieldSearchArgs & { view: AdminArchivedListView }
) {
	return ctx.db.query("bookings").withSearchIndex(args.indexName, (indexQuery) => {
		const searchQuery = indexQuery.search(args.searchField, args.searchText);

		if (args.view === "inbox") {
			return searchQuery.eq("archived", false);
		}

		return searchQuery;
	});
}

function adminBookingsFieldSearchQuery(
	ctx: QueryCtx,
	args: Pick<AdminBookingFieldSearchIndexArgs, "indexName" | "searchField" | "searchText" | "view">
) {
	switch (args.indexName) {
		case "search_admin_editor":
			return ctx.db.query("bookings").withSearchIndex("search_admin_editor", (indexQuery) => {
				const searchQuery = indexQuery.search("assignedEditorDisplayName", args.searchText);

				if (args.view === "inbox") {
					return searchQuery.eq("archived", false);
				}

				return searchQuery;
			});

		case "search_admin_name":
			return adminBookingsPackageFieldSearchQuery(ctx, {
				indexName: args.indexName,
				searchField: "name",
				searchText: args.searchText,
				view: args.view
			});

		case "search_admin_account":
			return adminBookingsPackageFieldSearchQuery(ctx, {
				indexName: args.indexName,
				searchField: "accountName",
				searchText: args.searchText,
				view: args.view
			});

		case "search_admin_ig":
			return adminBookingsPackageFieldSearchQuery(ctx, {
				indexName: args.indexName,
				searchField: "instagramHandle",
				searchText: args.searchText,
				view: args.view
			});

		default:
			return exhaustiveCheck(args.indexName);
	}
}

async function paginateAdminBookingsFieldSearch(
	ctx: QueryCtx,
	args: AdminBookingFieldSearchIndexArgs
) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			adminBookingsFieldSearchQuery(ctx, {
				indexName: args.indexName,
				searchField: args.searchField,
				searchText: args.searchText,
				view: args.view
			}).paginate({ cursor, numItems })
	});
}

async function paginateAdminBookingsBlobSearch(ctx: QueryCtx, args: AdminBlobSearchIndexArgs) {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			adminBookingsBlobSearchQuery(ctx, { searchText: args.searchText, view: args.view }).paginate({
				cursor,
				numItems
			})
	});
}

async function paginateSessionsByEmail(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	email: string
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_email", (indexQuery) => indexQuery.eq("email", email))
				.paginate({ cursor, numItems })
	});
}

async function paginateSessionsByReceipt(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	receiptNumber: string
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_receiptNumber", (indexQuery) =>
					indexQuery.eq("receiptNumber", receiptNumber)
				)
				.paginate({ cursor, numItems })
	});
}

async function paginateSessionsByPhone(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	phoneQuery: string
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const canonicalPhone = normalizePhone(phoneQuery);

	if (canonicalPhone.length === 0) {
		return emptyAdminSearchListPage();
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_phone", (indexQuery) => indexQuery.eq("phone", canonicalPhone))
				.paginate({ cursor, numItems })
	});
}

async function paginateSessionsByAbn(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	abnQuery: string
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const normalizedAbn = normalizeAbn(abnQuery);

	if (normalizedAbn.length === 0) {
		return emptyAdminSearchListPage();
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_abn", (indexQuery) => indexQuery.eq("abn", normalizedAbn))
				.paginate({ cursor, numItems })
	});
}

async function paginateSessionsByDate(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	dateValue: string
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const sessionStartRange = parseAdminSearchDateValue(dateValue, {
		now: new Date(),
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE
	});

	if (sessionStartRange === null) {
		return emptyAdminSearchListPage();
	}

	if (args.view === "inbox") {
		return paginateAdminSearchList({
			paginationOpts: args.paginationOpts,
			fetchPage: (cursor, numItems) =>
				ctx.db
					.query("bookings")
					.withIndex("by_archived_and_sessionStartAt", (indexQuery) =>
						indexQuery
							.eq("archived", false)
							.gte("sessionStartAt", sessionStartRange.rangeStart)
							.lt("sessionStartAt", sessionStartRange.rangeEnd)
					)
					.order(args.sortDirection)
					.paginate({ cursor, numItems })
		});
	}

	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_sessionStartAt", (indexQuery) =>
					indexQuery
						.gte("sessionStartAt", sessionStartRange.rangeStart)
						.lt("sessionStartAt", sessionStartRange.rangeEnd)
				)
				.order(args.sortDirection)
				.paginate({ cursor, numItems })
	});
}

async function paginateAdminSessionsByPrefixQuery(
	ctx: QueryCtx,
	args: AdminSessionSearchContext,
	parsedQuery: Exclude<ParsedAdminSearchQuery, { kind: "blob" }>
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	switch (parsedQuery.kind) {
		case "email":
			return paginateSessionsByEmail(ctx, args, parsedQuery.value);
		case "receipt":
			return paginateSessionsByReceipt(ctx, args, parsedQuery.value);
		case "date":
			return paginateSessionsByDate(ctx, args, parsedQuery.value);
		case "phone":
			return paginateSessionsByPhone(ctx, args, parsedQuery.value);
		case "abn":
			return paginateSessionsByAbn(ctx, args, parsedQuery.value);
		case "name":
		case "account":
		case "ig":
		case "editor": {
			const fieldSearch = adminPartialFieldSearchArgs(parsedQuery);

			return paginateAdminBookingsFieldSearch(ctx, {
				...fieldSearch,
				view: args.view,
				paginationOpts: args.paginationOpts
			});
		}

		default:
			return exhaustiveCheck(parsedQuery);
	}
}

async function paginateAdminSessionsWithSearch(
	ctx: QueryCtx,
	args: AdminSessionSearchContext & { parsedQuery: ParsedAdminSearchQuery }
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const { parsedQuery } = args;

	if (parsedQuery.kind === "blob") {
		if (parsedQuery.text.length === 0) {
			return emptyAdminSearchListPage();
		}

		return paginateAdminBookingsBlobSearch(ctx, {
			searchText: parsedQuery.text,
			view: args.view,
			paginationOpts: args.paginationOpts
		});
	}

	return paginateAdminSessionsByPrefixQuery(ctx, args, parsedQuery);
}

async function paginateAdminSessionsWithoutSearch(
	ctx: QueryCtx,
	args: AdminSessionSearchContext
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const { sortBy, sortDirection, view, paginationOpts } = args;

	const bookingsPage =
		sortBy === "createdAt"
			? await paginateAdminSessionsByCreatedAt(ctx, view, sortDirection, paginationOpts)
			: await paginateAdminSessionsBySessionStart(ctx, view, sortDirection, paginationOpts);

	return {
		continueCursor: bookingsPage.continueCursor,
		isDone: bookingsPage.isDone,
		page: bookingsPage.page,
		refineSearch: false
	};
}

async function loadAdminSessionListRows(ctx: QueryCtx, sessionsPage: Doc<"bookings">[]) {
	return Promise.all(
		sessionsPage.map(async (session) => {
			const [hasDriveWorkflowFailure, stripeInvoicesResult] = await Promise.all([
				getDriveWorkflowFailureForBooking(ctx, session),
				listStripeInvoicesForBooking(ctx, session._id)
			]);

			const invoices = stripeInvoicesResult.unwrapOr([]);

			const stripeInvoicesSummary = summarizeStripeInvoices(invoices);

			const paidAmount = calculatePaidAmount({
				originalPaidAmount: session.originalPaidAmount ?? null,
				invoices,
				paidRemainingBalanceAmount: session.paidRemainingBalance
					? session.remainingBalanceAmount
					: 0
			});

			if (!session.packageId) {
				return { ...session, hasDriveWorkflowFailure, stripeInvoicesSummary, paidAmount };
			}

			const packageRecord = await ctx.db.get("packages", session.packageId);

			if (!packageRecord) {
				return { ...session, hasDriveWorkflowFailure, stripeInvoicesSummary, paidAmount };
			}

			const packageSessionsResult = await getCapacityConsumingPackageSessions(
				ctx,
				packageRecord._id,
				packageRecord.packageSize
			);

			if (packageSessionsResult.isErr()) {
				throw new Error("getCapacityConsumingPackageSessions failed");
			}

			const packageSessions = packageSessionsResult.value;

			const [packageInvoices, sessionInvoices] = await Promise.all([
				listStripeInvoicesForPackage(ctx, packageRecord._id),
				listStripeInvoicesForBookings(
					ctx,
					packageSessionsResult.value.map((booking) => booking._id)
				)
			]);

			return {
				...session,
				hasDriveWorkflowFailure,
				stripeInvoicesSummary,
				paidAmount: calculatePaidAmount({
					originalPaidAmount: packageRecord.originalPaidAmount ?? null,
					invoices: [...packageInvoices.unwrapOr([]), ...sessionInvoices.unwrapOr([])]
				}),
				linkedPackageSize: packageRecord.packageSize,
				packageStripeCustomerId: packageRecord.stripeCustomerId,
				packageSessionPosition: sessionConsumesPackageCapacity(session)
					? packageSessions.findIndex(({ _id }) => _id === session._id) + 1
					: undefined
			};
		})
	);
}

async function fetchAdminSessionsListPage(
	ctx: QueryCtx,
	args: ListAdminSessionsArgs
): Promise<AdminSearchListPage<Doc<"bookings">>> {
	const sortBy = args.sortBy ?? "session";
	const sortDirection = args.sortDirection ?? "asc";
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? true;
	const parsedSearchQuery = parseTrimmedAdminSearchQuery(args.searchQuery);

	const searchContext: AdminSessionSearchContext = {
		sortBy,
		sortDirection,
		view,
		includeStale,
		paginationOpts: args.paginationOpts
	};

	return parsedSearchQuery
		? paginateAdminSessionsWithSearch(ctx, { ...searchContext, parsedQuery: parsedSearchQuery })
		: paginateAdminSessionsWithoutSearch(ctx, searchContext);
}

export async function listAdminSessions(ctx: QueryCtx, args: ListAdminSessionsArgs) {
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? true;

	const bookingsPage = await fetchAdminSessionsListPage(ctx, args);

	const visibleSessions = applyAdminSessionListVisibility(bookingsPage.page, view, includeStale);

	const page = await loadAdminSessionListRows(ctx, visibleSessions);

	return { ...bookingsPage, page };
}
