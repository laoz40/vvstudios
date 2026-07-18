import type { Doc } from "#convex/_generated/dataModel";
import { bookingConsumesPackageCapacity } from "#convex/lib/packageScheduling";

export type BookingRecord = Doc<"bookings"> & {
	multiBookingInvoiceNumber?: string;
	multiBookingPackageSize?: 4 | 8 | 12;
	multiBookingPackageSessionPosition?: number;
};

export function isCapacityConsumingPackageBooking(booking: BookingRecord) {
	return booking.multiBookingPackageId !== undefined && bookingConsumesPackageCapacity(booking);
}

export type BookingActionDetails = {
	canGenerateRescheduleLink: boolean;
	customerBookingId: string;
	canManageConfirmedBooking: boolean;
	isPastBooking: boolean;
};

export const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function isManageableConfirmedBooking(booking: BookingRecord) {
	return booking.status === "confirmed" || booking.status === "email_failed";
}

export function isStaleCleanupBooking(booking: BookingRecord, now = Date.now()) {
	if (booking.status === "expired" || booking.status === "abandoned") {
		return true;
	}

	return (
		booking.status === "pending_payment" &&
		booking.pendingPaymentCreatedAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
}

export function getPackageSessionProgressLabel(booking: BookingRecord) {
	if (!booking.multiBookingPackageId) {
		return null;
	}

	if (
		!isCapacityConsumingPackageBooking(booking) ||
		!booking.multiBookingPackageSize ||
		!booking.multiBookingPackageSessionPosition
	) {
		return "Package";
	}

	return `${booking.multiBookingPackageSessionPosition}/${booking.multiBookingPackageSize}`;
}
