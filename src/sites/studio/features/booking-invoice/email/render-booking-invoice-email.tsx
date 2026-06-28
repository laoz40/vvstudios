import { render } from "@react-email/render";
import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";
import { err, ok } from "#/lib/result";

export async function renderBookingInvoiceEmail(data: BookingInvoiceData) {
	try {
		const html = await render(<BookingInvoiceEmail data={data} />);
		return ok(html);
	} catch {
		return err({ reason: "INVOICE_EMAIL_RENDER_FAILED" });
	}
}
