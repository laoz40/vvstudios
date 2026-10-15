import { render } from "@react-email/render";
import { tryPromise } from "#convex/shared/lib/result";
import { logError } from "#convex/shared/lib/logger";
import { BookingReceiptEmail } from "#studio/features/booking-invoice/email/BookingReceiptEmail";
import type { BookingReceiptData } from "#studio/features/booking-invoice/lib/types";

export function renderBookingReceiptEmail(data: BookingReceiptData) {
	return tryPromise({
		try: () => render(<BookingReceiptEmail data={data} />),
		catch: (cause) => {
			const failure = { reason: "RECEIPT_EMAIL_RENDER_FAILED" } as const;

			logError(
				{ operation: "email.renderReceipt", ...failure, receiptNumber: data.receipt.number },
				cause
			);

			return failure;
		}
	});
}
