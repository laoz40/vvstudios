import type { Doc } from "#convex/_generated/dataModel";
import { bookingConsumesPackageCapacity } from "#convex/lib/packageScheduling";
import {
	DURATION_OPTIONS,
	isAddonOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

export type BookingRecord = Doc<"bookings"> & {
	multiBookingInvoiceNumber?: string;
	multiBookingPackageSize?: 4 | 8 | 12;
	multiBookingPackageSessionPosition?: number;
};

export function toAdminBookingAddons(addons: readonly string[]): BookingFormValues["addons"] {
	return addons.filter(isAddonOption);
}

export function toAdminBookingDuration(
	duration: string | undefined
): BookingFormValues["duration"] {
	return DURATION_OPTIONS.find((option) => option === duration) ?? "";
}

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
