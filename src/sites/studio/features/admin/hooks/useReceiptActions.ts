import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { resendReceiptWithFeedback } from "#studio/features/admin/lib/resend-receipt";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

export function useReceiptActions(session: SessionRecord) {
	const resendBookingReceipt = useAction(api.receiptEmails.resendBookingReceipt);
	const getAdminBookingReceiptPdf = useAction(api.invoices.getAdminBookingReceiptPdfByBookingId);
	const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

	async function handleDownloadReceipt() {
		setIsDownloadingReceipt(true);

		const [error, receipt] = await tryCatch(getAdminBookingReceiptPdf({ bookingId: session._id }));

		setIsDownloadingReceipt(false);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");

					return;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download receipts.");

					return;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");

					return;
				case "BOOKING_NOT_CONFIRMED":
					toast.error("Receipts are only available for confirmed bookings.");

					return;
				case "INVALID_BOOKING_DATA":
				case "RECEIPT_PDF_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate receipt.");

					return;
				default:
					exhaustiveCheck(reason);
			}
		}

		downloadBlob(new Blob([receipt.content], { type: receipt.contentType }), receipt.filename);
		toast.success("Receipt download started.");
	}

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

	return { handleDownloadReceipt, handleResendReceipt, isDownloadingReceipt };
}
