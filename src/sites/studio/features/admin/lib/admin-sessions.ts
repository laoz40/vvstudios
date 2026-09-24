import type { Doc } from "#convex/_generated/dataModel";
import { sessionConsumesPackageCapacity } from "#convex/lib/packageSessionCapacity";
import { customerFilter } from "#studio/features/admin/components/AdminDashboardTableUtils";
import {
	DURATION_OPTIONS,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

export type SessionRecord = Doc<"bookings"> & {
	assignedEditorDisplayName?: string;
	hasDriveWorkflowFailure?: boolean;
	packageInvoiceNumber?: string;
	linkedPackageSize?: 4 | 8 | 12;
	packageSessionPosition?: number;
	packageStripeCustomerId?: string;
	stripeInvoicesSummary?: { paymentStatus: "paid" | "unpaid"; totalAmount: number } | null;
};

export function toAdminSessionDuration(
	duration: string | undefined
): BookingFormValues["duration"] {
	return DURATION_OPTIONS.find((option) => option === duration) ?? "";
}

function isCapacityConsumingPackageSession(session: SessionRecord) {
	return session.packageId !== undefined && sessionConsumesPackageCapacity(session);
}

export type SessionActionDetails = {
	canGenerateRescheduleLink: boolean;
	customerSessionId: string;
	canManageConfirmedSession: boolean;
	isPastSession: boolean;
};

export function isManageableConfirmedSession(session: SessionRecord) {
	return session.status === "confirmed" || session.status === "email_failed";
}

export function getPackageSessionProgressLabel(session: SessionRecord) {
	if (!session.packageId) {
		return null;
	}

	if (
		!isCapacityConsumingPackageSession(session) ||
		!session.linkedPackageSize ||
		!session.packageSessionPosition
	) {
		return "Package";
	}

	return `${session.packageSessionPosition}/${session.linkedPackageSize}`;
}

export type SessionSortId = "session" | "createdAt";

export type SessionSorting = { id: SessionSortId; desc: boolean }[];

export type SessionListSortDirection = "asc" | "desc";

export type SessionListQuerySort = {
	sortBy: SessionSortId;
	sortDirection: SessionListSortDirection;
};

export type AdminSessionsView = "inbox" | "all";

export type AdminSessionsListQuery = SessionListQuerySort & {
	view: AdminSessionsView;
	includeStale: boolean;
};

export function toSessionListQuerySort(sorting: SessionSorting): SessionListQuerySort {
	const activeSort = sorting.at(0) ?? { id: "session", desc: false };

	return { sortBy: activeSort.id, sortDirection: activeSort.desc ? "desc" : "asc" };
}

export type AdminSessionFilters = { searchQuery: string };

// Client-side search on whatever usePaginatedQuery has loaded so far. listSessions does not
// take searchQuery; matching rows on later pages only appear after loadMore (see prefetch in
// SessionsTable). Inbox vs all and stale checkout rows are server-side on listSessions.
export function filterAdminSessions(sessions: SessionRecord[], filters: AdminSessionFilters) {
	return sessions.filter((session) => customerFilter({ original: session }, filters.searchQuery));
}
