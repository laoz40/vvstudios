import { errAsync, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";

export type HostRescheduleBooking = Pick<
	Doc<"bookings">,
	| "name"
	| "email"
	| "phone"
	| "accountName"
	| "abn"
	| "date"
	| "time"
	| "service"
	| "duration"
	| "addons"
	| "notes"
> &
	BookingAddonQuantitiesArgs;

export function bookingRescheduledCustomerEmailArgs(
	booking: Doc<"bookings">,
	options: { originalDate: string; originalTime: string; rescheduleUrl?: string }
) {
	return {
		addons: booking.addons,
		date: booking.date,
		duration: booking.duration,
		email: booking.email,
		name: booking.name,
		originalDate: options.originalDate,
		originalTime: options.originalTime,
		rescheduleUrl: options.rescheduleUrl,
		service: booking.service,
		time: booking.time,
		...pickBookingAddonQuantities(booking)
	};
}

export function bookingInvoiceArtifactCreatedAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

export function hostRescheduleEmailArgs(
	parsedBooking: HostRescheduleBooking,
	invoiceNumber: string,
	options: { originalDate: string; originalTime: string }
) {
	return {
		invoiceNumber,
		name: parsedBooking.name,
		email: parsedBooking.email,
		phone: parsedBooking.phone,
		accountName: parsedBooking.accountName,
		abn: parsedBooking.abn,
		date: parsedBooking.date,
		time: parsedBooking.time,
		service: parsedBooking.service,
		duration: parsedBooking.duration,
		addons: parsedBooking.addons,
		notes: parsedBooking.notes,
		reschedule: { originalDate: options.originalDate, originalTime: options.originalTime },
		...pickBookingAddonQuantities(parsedBooking)
	};
}

export function logCustomerHostRescheduleEmailFailure(
	bookingId: Id<"bookings">,
	error: { reason: string }
) {
	console.error("Booking reschedule host email send failed", { bookingId, reason: error.reason });

	return okAsync(null);
}

export function logSessionHostRescheduleEmailFailure(
	bookingId: Id<"bookings">,
	error: { reason: string }
) {
	console.error("Session reschedule host email send failed", { bookingId, reason: error.reason });

	return errAsync({ reason: "HOST_EMAIL_SEND_FAILED" as const });
}

export function logAdminHostRescheduleEmailFailure(
	bookingId: Id<"bookings">,
	error: { reason: string }
) {
	console.error("Admin session reschedule host email send failed", {
		bookingId,
		reason: error.reason
	});

	return okAsync(null);
}
