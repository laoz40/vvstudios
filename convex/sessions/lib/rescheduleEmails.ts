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
		bookingId: booking._id,
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
	bookingId: Id<"bookings">,
	parsedBooking: HostRescheduleBooking,
	invoiceNumber: string,
	options: { originalDate: string; originalTime: string }
) {
	return {
		bookingId,
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
