import { render } from "@react-email/render";
import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";

export async function renderBookingInvoiceEmail(data: BookingInvoiceData) {
	return await render(<BookingInvoiceEmail data={data} />);
}
