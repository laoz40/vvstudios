import { render } from "@react-email/render";
import { tryPromise } from "#convex/lib/result";
import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";

export function renderBookingInvoiceEmail(data: BookingInvoiceData) {
	return tryPromise({
		try: () => render(<BookingInvoiceEmail data={data} />),
		catch: (cause) => {
			console.error("Booking invoice email render failed", {
				invoiceNumber: data.invoice.number,
				cause
			});

			return { reason: "INVOICE_EMAIL_RENDER_FAILED" as const };
		}
	});
}
