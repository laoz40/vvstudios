import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { bookingSchema } from "../../src/sites/studio/features/booking-form/lib/form-shared";
import { createBookingInvoiceArtifacts } from "../../src/sites/studio/features/booking-invoice/lib/create-booking-invoice-artifacts";

type InvalidBookingDataError = {
	code: "INVALID_BOOKING_DATA";
};

export async function createBookingInvoiceArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
) {
	const parsedBooking = bookingSchema.safeParse({
		name: booking.name,
		phone: booking.phone,
		accountName: booking.accountName,
		abn: booking.abn,
		email: booking.email,
		date: booking.date,
		time: booking.time,
		duration: booking.duration,
		service: booking.service,
		addons: booking.addons,
		deliverableCount: booking.deliverableCount ?? "",
		notes: booking.notes ?? "",
	});

	if (!parsedBooking.success) {
		throw new ConvexError<InvalidBookingDataError>({ code: "INVALID_BOOKING_DATA" });
	}

	const artifacts = await createBookingInvoiceArtifacts({
		bookingId: booking._id,
		name: parsedBooking.data.name,
		phone: parsedBooking.data.phone,
		accountName: parsedBooking.data.accountName,
		abn: parsedBooking.data.abn,
		email: parsedBooking.data.email,
		date: parsedBooking.data.date,
		time: parsedBooking.data.time,
		duration: parsedBooking.data.duration,
		service: parsedBooking.data.service,
		addons: parsedBooking.data.addons,
		deliverableCount: parsedBooking.data.deliverableCount || undefined,
		createdAt,
	});

	return { artifacts, booking: parsedBooking.data };
}
