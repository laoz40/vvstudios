import type { Doc } from "#convex/_generated/dataModel";
import { sessionConsumesPackageCapacity } from "#convex/lib/packageScheduling";
import { customerFilter } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { hasUnsentDeliverables } from "#studio/features/admin/lib/session-edit-status";
import { hasUnpaidRemainingBalance } from "#studio/features/admin/lib/remaining-balance";
import {
	DURATION_OPTIONS,
	normalizeBookingAddon,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { getBookingStartTimestamp, isUpcomingBooking } from "#studio/lib/bookingdatetime";

export type SessionRecord = Doc<"bookings"> & {
	hasDriveWorkflowFailure?: boolean;
	multiBookingInvoiceNumber?: string;
	multiBookingPackageSize?: 4 | 8 | 12;
	multiBookingPackageSessionPosition?: number;
};

export function toAdminSessionAddons(addons: readonly string[]): BookingFormValues["addons"] {
	return addons.flatMap((addon) => {
		const normalizedAddon = normalizeBookingAddon(addon);
		return normalizedAddon ? [normalizedAddon] : [];
	});
}

export function toAdminSessionDuration(
	duration: string | undefined
): BookingFormValues["duration"] {
	return DURATION_OPTIONS.find((option) => option === duration) ?? "";
}

export function isCapacityConsumingPackageSession(session: SessionRecord) {
	return session.multiBookingPackageId !== undefined && sessionConsumesPackageCapacity(session);
}

export type SessionActionDetails = {
	canGenerateRescheduleLink: boolean;
	customerSessionId: string;
	canManageConfirmedSession: boolean;
	isPastSession: boolean;
};

export const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function isManageableConfirmedSession(session: SessionRecord) {
	return session.status === "confirmed" || session.status === "email_failed";
}

export function isStaleCleanupSession(session: SessionRecord, now = Date.now()) {
	if (session.status === "expired" || session.status === "abandoned") {
		return true;
	}

	return (
		session.status === "pending_payment" &&
		session.pendingPaymentCreatedAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
}

export function getPackageSessionProgressLabel(session: SessionRecord) {
	if (!session.multiBookingPackageId) {
		return null;
	}

	if (
		!isCapacityConsumingPackageSession(session) ||
		!session.multiBookingPackageSize ||
		!session.multiBookingPackageSessionPosition
	) {
		return "Package";
	}

	return `${session.multiBookingPackageSessionPosition}/${session.multiBookingPackageSize}`;
}

export type SessionSortId = "name" | "session" | "createdAt";
export type SessionSorting = { id: SessionSortId; desc: boolean }[];

export type AdminSessionFilters = {
	searchQuery: string;
	showArchived: boolean;
	showStaleSessions: boolean;
	showUpcomingOnly: boolean;
};

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

export function sortAdminSessions(sessions: SessionRecord[], sorting: SessionSorting) {
	const activeSort = sorting.at(0);

	if (!activeSort) {
		return sessions;
	}

	return sessions.toSorted((firstSession, secondSession) => {
		let comparison = 0;

		switch (activeSort.id) {
			case "name":
				comparison = firstSession.name.localeCompare(secondSession.name);
				break;

			case "session":
				comparison =
					getBookingStartTimestamp(firstSession.date, firstSession.time) -
					getBookingStartTimestamp(secondSession.date, secondSession.time);
				break;

			case "createdAt":
				comparison = firstSession.pendingPaymentCreatedAt - secondSession.pendingPaymentCreatedAt;
				break;

			default: {
				const _exhaustive: never = activeSort.id;
				return _exhaustive;
			}
		}

		return activeSort.desc ? -comparison : comparison;
	});
}
