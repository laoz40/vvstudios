import { useAction } from "convex/react";
import { api } from "#convex/_generated/api";
import { resendReceiptWithFeedback } from "#studio/features/admin/lib/resend-receipt";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function useReceiptActions(session: SessionRecord) {
	const resendBookingReceipt = useAction(api.receiptEmails.resendBookingReceipt);

	function handleResendReceipt() {
		return resendReceiptWithFeedback({
			customerEmail: session.email,
			entityMessages: {
				BOOKING_NOT_CONFIRMED: "Receipts are only available for confirmed bookings.",
				BOOKING_NOT_FOUND: "That session no longer exists."
			},
			run: () => resendBookingReceipt({ bookingId: session._id })
		});
	}

	return { handleResendReceipt };
}
