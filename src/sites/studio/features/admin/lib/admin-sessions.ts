import type { Doc } from "#convex/_generated/dataModel";
import { sessionConsumesPackageCapacity } from "#convex/lib/packageScheduling";
import { customerFilter } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { hasUnsentDeliverables } from "#studio/features/admin/lib/session-edit-status";
import { hasUnpaidRemainingBalance } from "#studio/features/admin/lib/remaining-balance";
import {
	DURATION_OPTIONS,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

export type SessionRecord = Doc<"bookings"> & {
	hasDriveWorkflowFailure?: boolean;
	packageInvoiceNumber?: string;
	linkedPackageSize?: 4 | 8 | 12;
	packageSessionPosition?: number;
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

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function isManageableConfirmedSession(session: SessionRecord) {
	return session.status === "confirmed" || session.status === "email_failed";
}

function isStaleCleanupSession(session: SessionRecord, now = Date.now()) {
	if (session.status === "expired" || session.status === "abandoned") {
		return true;
	}

	return (
		session.status === "pending_payment" &&
		session.pendingPaymentCreatedAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
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

export function toSessionListQuerySort(sorting: SessionSorting): SessionListQuerySort {
	const activeSort = sorting.at(0) ?? { id: "session", desc: false };

	return { sortBy: activeSort.id, sortDirection: activeSort.desc ? "desc" : "asc" };
}

export type AdminSessionFilters = {
	searchQuery: string;
	showArchived: boolean;
	showStaleSessions: boolean;
	showUpcomingOnly: boolean;
};

// Leo: Currently client filters paginated data. Fine at current volume. Prefetches when
// filters hide every loaded row. Won't scale as bookings grow.
//
// Server-side filtering probably needed in the future. Idea to explore:
// - Split upcoming (future sessions) and needs action (unpaid or deliverables
//   not sent) into separate views instead of one toggle
// - Upfront payment may simplify the unpaid case
// - might not be necessary to even filter for unpaid as deliverables won't be sent until payment is received
export function filterAdminSessions(sessions: SessionRecord[], filters: AdminSessionFilters) {
	return sessions.filter((session) => {
		if (!filters.showArchived && session.hiddenAt !== undefined) {
			return false;
		}

		if (!customerFilter({ original: session }, filters.searchQuery)) {
			return false;
		}

		if (!filters.showStaleSessions && session.status === "cancelled") {
			return false;
		}

		if (
			filters.showUpcomingOnly &&
			!isUpcomingBooking(session.date, session.time) &&
			!hasUnsentDeliverables(session) &&
			!hasUnpaidRemainingBalance(session)
		) {
			return false;
		}

		if (!filters.showStaleSessions && isStaleCleanupSession(session)) {
			return false;
		}

		return true;
	});
}
