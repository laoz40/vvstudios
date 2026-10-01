import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { exhaustiveCheck } from "#/lib/result";
import { env } from "#convex/env";
import {
	paginateAdminSessionsByCreatedAt,
	paginateAdminSessionsBySessionStart,
	passesAdminInboxStaleFilter,
	type AdminSessionListSortDirection,
	type AdminSessionsView
} from "#convex/lib/adminSessionList";
import type { ParsedAdminSearchQuery } from "#convex/lib/adminSearchQuery";
import { adminPartialFieldSearchArgs } from "#convex/lib/adminSearchPrefixFilters";
import {
	emptyAdminSearchListPage,
	paginateAdminBookingsBlobSearch,
	paginateAdminBookingsFieldSearch,
	paginateAdminSearchList,
	type AdminSearchListPage
} from "#convex/lib/adminSearchPagination";
import { normalizeAbn, normalizePhone } from "#convex/lib/contactNormalization";
import { parseAdminSearchDateValue } from "#convex/lib/adminSearchDateParse";

type AdminSessionPaginationOpts = { numItems: number; cursor: string | null };

type SessionListSortBy = "session" | "createdAt";

export type AdminSessionSearchArgs = {
	sortBy: SessionListSortBy;
	sortDirection: AdminSessionListSortDirection;
	view: AdminSessionsView;
	includeStale: boolean;
	paginationOpts: AdminSessionPaginationOpts;
	parsedQuery: ParsedAdminSearchQuery;
};

type AdminSessionSearchPage = AdminSearchListPage<Doc<"bookings">>;

function isVisibleSessionMatch(
	session: Doc<"bookings">,
	view: AdminSessionsView,
	includeStale: boolean
) {
	if (view === "inbox" && session.archived) {
		return false;
	}

	return passesAdminInboxStaleFilter(session, includeStale);
}

function includeSessionRow(args: Pick<AdminSessionSearchArgs, "view" | "includeStale">) {
	return (session: Doc<"bookings">) => isVisibleSessionMatch(session, args.view, args.includeStale);
}

async function paginateSessionsByEmail(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	email: string
): Promise<AdminSessionSearchPage> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_email", (indexQuery) => indexQuery.eq("email", email))
				.paginate({ cursor, numItems }),
		includeRow: includeSessionRow(args)
	});
}

async function paginateSessionsByReceipt(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	receiptNumber: string
): Promise<AdminSessionSearchPage> {
	return paginateAdminSearchList({
		paginationOpts: args.paginationOpts,
		fetchPage: (cursor, numItems) =>
			ctx.db
				.query("bookings")
				.withIndex("by_receiptNumber", (indexQuery) =>
					indexQuery.eq("receiptNumber", receiptNumber)
				)
				.paginate({ cursor, numItems }),
		includeRow: includeSessionRow(args)
	});
}

async function paginateSessionsByPhone(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	phoneQuery: string
): Promise<AdminSessionSearchPage> {
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
				.paginate({ cursor, numItems }),
		includeRow: includeSessionRow(args)
	});
}

async function paginateSessionsByAbn(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	abnQuery: string
): Promise<AdminSessionSearchPage> {
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
				.paginate({ cursor, numItems }),
		includeRow: includeSessionRow(args)
	});
}

async function paginateSessionsByDate(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	dateValue: string
): Promise<AdminSessionSearchPage> {
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
					.paginate({ cursor, numItems }),
			includeRow: includeSessionRow(args)
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
				.paginate({ cursor, numItems }),
		includeRow: includeSessionRow(args)
	});
}

async function paginateAdminSessionsByPrefixQuery(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs,
	parsedQuery: Exclude<ParsedAdminSearchQuery, { kind: "blob" }>
): Promise<AdminSessionSearchPage> {
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
				includeStale: args.includeStale,
				paginationOpts: args.paginationOpts
			});
		}

		default:
			return exhaustiveCheck(parsedQuery);
	}
}

export async function paginateAdminSessionsWithSearch(
	ctx: QueryCtx,
	args: AdminSessionSearchArgs
): Promise<AdminSessionSearchPage> {
	const { parsedQuery } = args;

	if (parsedQuery.kind === "blob") {
		if (parsedQuery.text.length === 0) {
			return emptyAdminSearchListPage();
		}

		return paginateAdminBookingsBlobSearch(ctx, {
			searchText: parsedQuery.text,
			view: args.view,
			includeStale: args.includeStale,
			paginationOpts: args.paginationOpts
		});
	}

	return paginateAdminSessionsByPrefixQuery(ctx, args, parsedQuery);
}

export function paginateAdminSessionsWithoutSearch(
	ctx: QueryCtx,
	args: Omit<AdminSessionSearchArgs, "parsedQuery">
) {
	const { sortBy, sortDirection, view, paginationOpts } = args;

	if (sortBy === "createdAt") {
		return paginateAdminSessionsByCreatedAt(ctx, view, sortDirection, paginationOpts);
	}

	return paginateAdminSessionsBySessionStart(ctx, view, sortDirection, paginationOpts);
}
