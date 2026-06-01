import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { bookingSchema } from "../../src/sites/studio/features/booking-form/lib/form-shared";
import { buildBookingInvoiceData } from "../../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { renderBookingInvoiceEmail } from "../../src/sites/studio/features/booking-invoice/email/render-booking-invoice-email";
import type { BookingInvoiceData } from "../../src/sites/studio/features/booking-invoice/lib/types";

type InvalidBookingDataError = {
	code: "INVALID_BOOKING_DATA";
};

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

export async function createBookingInvoiceEmailArtifactsForBooking(
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

	const data = buildBookingInvoiceData({
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
	const emailHtml = await renderBookingInvoiceEmail(data);

	return {
		artifacts: {
			data,
			emailHtml,
			pdf: {
				contentType: "application/pdf",
				filename: createPdfFilename(data.invoice.number),
			},
		},
		booking: parsedBooking.data,
	};
}

export async function renderBookingInvoicePdfInNode(data: BookingInvoiceData) {
	const { renderBookingInvoicePdf } = await import(
		"../../src/sites/studio/features/booking-invoice/pdf/render-booking-invoice-pdf"
	);

	return await renderBookingInvoicePdf(data);
}
