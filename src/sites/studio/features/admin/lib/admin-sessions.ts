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

export type StaleCleanupBookingCounts = Record<BookingRecord["status"], number>;

export const emptyStaleCleanupBookingCounts: StaleCleanupBookingCounts = {
	abandoned: 0,
	confirmed: 0,
	cancelled: 0,
	expired: 0,
	email_failed: 0,
	failed: 0,
	pending_payment: 0
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
	const activeSort = sorting[0];

	if (!activeSort) {
		return bookings;
	}

	return [...bookings].sort((firstBooking, secondBooking) => {
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

export function getStaleCleanupBookingCounts(bookings: BookingRecord[]) {
	return bookings.reduce<StaleCleanupBookingCounts>(
		(accumulator, booking) => {
			accumulator[booking.status] += 1;
			return accumulator;
		},
		{ ...emptyStaleCleanupBookingCounts }
	);
}
