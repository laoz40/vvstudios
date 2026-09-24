import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";

export type AdminSessionsView = "inbox" | "all";

export type AdminSessionListSortDirection = "asc" | "desc";

type AdminSessionPaginationOpts = { numItems: number; cursor: string | null };

export function paginateAdminSessionsBySessionStart(
	ctx: QueryCtx,
	view: AdminSessionsView,
	sortDirection: AdminSessionListSortDirection,
	paginationOpts: AdminSessionPaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("bookings")
			.withIndex("by_hiddenAt_and_sessionStartAt", (query) => query.eq("hiddenAt", undefined))
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("bookings")
		.withIndex("by_sessionStartAt")
		.order(sortDirection)
		.paginate(paginationOpts);
}

export function paginateAdminSessionsByCreatedAt(
	ctx: QueryCtx,
	view: AdminSessionsView,
	sortDirection: AdminSessionListSortDirection,
	paginationOpts: AdminSessionPaginationOpts
) {
	if (view === "inbox") {
		return ctx.db
			.query("bookings")
			.withIndex("by_hiddenAt_and_pendingPaymentCreatedAt", (query) =>
				query.eq("hiddenAt", undefined)
			)
			.order(sortDirection)
			.paginate(paginationOpts);
	}

	return ctx.db
		.query("bookings")
		.withIndex("by_pendingPaymentCreatedAt")
		.order(sortDirection)
		.paginate(paginationOpts);
}

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

export function passesAdminInboxStaleFilter(
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
