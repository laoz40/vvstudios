import { render } from "@react-email/render";
import { tryPromise } from "#convex/lib/result";
import { BookingReceiptEmail } from "#studio/features/booking-invoice/email/BookingReceiptEmail";
import type { BookingReceiptData } from "#studio/features/booking-invoice/lib/types";

export function renderBookingReceiptEmail(data: BookingReceiptData) {
	return tryPromise({
		try: () => render(<BookingReceiptEmail data={data} />),
		catch: (cause) => {
			console.error("Booking receipt email render failed", {
				receiptNumber: data.receipt.number,
				cause
			});

			return { reason: "RECEIPT_EMAIL_RENDER_FAILED" as const };
		}
	});
}
