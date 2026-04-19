import { render } from "@react-email/render";
import { BookingInvoiceEmail } from "#/features/booking-invoice/email/BookingInvoiceEmail";
import type { BookingInvoiceData } from "#/features/booking-invoice/lib/types";

export async function renderBookingInvoiceEmail(data: BookingInvoiceData) {
	return await render(<BookingInvoiceEmail data={data} />);
}
