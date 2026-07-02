import type { Doc } from "#convex/_generated/dataModel";

export type BookingRecord = Doc<"bookings">;

export type BookingActionDetails = {
	canGenerateRescheduleLink: boolean;
	canToggleStatus: boolean;
	customerBookingId: string;
	canManageConfirmedBooking: boolean;
	isPastBooking: boolean;
	toggleStatusLabel: string;
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
