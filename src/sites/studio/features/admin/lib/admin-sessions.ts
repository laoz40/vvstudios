import { customerFilter } from "#studio/features/admin/components/AdminDashboardTableUtils";
import {
	isStaleCleanupBooking,
	type BookingRecord
} from "#studio/features/admin/lib/admin-bookings";
import { hasUnpaidRemainingBalance } from "#studio/features/admin/lib/remaining-balance";
import { hasUnsentDeliverables } from "#studio/features/admin/lib/booking-edit-status";
import { getBookingStartTimestamp, isUpcomingBooking } from "#studio/lib/bookingdatetime";

export type SessionSortId = "name" | "session" | "createdAt";
export type SessionSorting = { id: SessionSortId; desc: boolean }[];

export type AdminSessionFilters = {
	searchQuery: string;
	showArchived: boolean;
	showStaleBookings: boolean;
	showUpcomingOnly: boolean;
};

export function filterAdminSessionBookings(
	bookings: BookingRecord[],
	filters: AdminSessionFilters
) {
	return bookings.filter((booking) => {
		if (!filters.showArchived && booking.hiddenAt !== undefined) {
			return false;
		}

		if (!customerFilter({ original: booking }, filters.searchQuery)) {
			return false;
		}

		if (!filters.showStaleBookings && booking.status === "cancelled") {
			return false;
		}

		if (
			filters.showUpcomingOnly &&
			!isUpcomingBooking(booking.date, booking.time) &&
			!hasUnsentDeliverables(booking) &&
			!hasUnpaidRemainingBalance(booking)
		) {
			return false;
		}

		if (!filters.showStaleBookings && isStaleCleanupBooking(booking)) {
			return false;
		}

		return true;
	});
}

export function sortAdminSessionBookings(bookings: BookingRecord[], sorting: SessionSorting) {
	const activeSort = sorting.at(0);

	if (!activeSort) {
		return bookings;
	}

	return bookings.toSorted((firstBooking, secondBooking) => {
		let comparison = 0;

		switch (activeSort.id) {
			case "name":
				comparison = firstBooking.name.localeCompare(secondBooking.name);
				break;

			case "session":
				comparison =
					getBookingStartTimestamp(firstBooking.date, firstBooking.time) -
					getBookingStartTimestamp(secondBooking.date, secondBooking.time);
				break;

			case "createdAt":
				comparison = firstBooking.pendingPaymentCreatedAt - secondBooking.pendingPaymentCreatedAt;
				break;

			default: {
				const _exhaustive: never = activeSort.id;
				return _exhaustive;
			}
		}

		return activeSort.desc ? -comparison : comparison;
	});
}
