import { render } from "@react-email/render";
import { ResultAsync } from "neverthrow";
import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";

export function renderBookingInvoiceEmail(data: BookingInvoiceData) {
	return ResultAsync.fromPromise(render(<BookingInvoiceEmail data={data} />), () => ({
		reason: "INVOICE_EMAIL_RENDER_FAILED" as const
	}));
}
