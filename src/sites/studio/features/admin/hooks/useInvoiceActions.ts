import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SendBookingInvoiceForBookingResult } from "#convex/googleCalendar";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function useInvoiceActions(booking: BookingRecord) {
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const [isEmailInvoiceDialogOpen, setIsEmailInvoiceDialogOpen] = useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);
	const [isEmailingInvoice, setIsEmailingInvoice] = useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({ booking, createdAt: booking.pendingPaymentCreatedAt })
		);

		if (error !== null) {
			switch (error.reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(error.message);
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsDownloadingInvoice(false);
			return;
		}

		toast.success("Invoice download started.");
		setIsDownloadingInvoice(false);
	}

	async function handleEmailInvoice() {
		setIsEmailingInvoice(true);

		const [error] = await tryCatch<SendBookingInvoiceForBookingResult>(
			sendBookingInvoiceForBooking({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send invoice emails.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "INVOICE_SEND_FAILED":
					toast.error("Unable to send invoice email.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice email.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsEmailingInvoice(false);
			return;
		}

		setIsEmailInvoiceDialogOpen(false);
		toast.success(`Invoice sent to ${booking.email}.`);
		setIsEmailingInvoice(false);
	}

	return {
		handleDownloadInvoice,
		handleEmailInvoice,
		isCustomInvoiceDialogOpen,
		isDownloadingInvoice,
		isEmailInvoiceDialogOpen,
		isEmailingInvoice,
		setIsCustomInvoiceDialogOpen,
		setIsEmailInvoiceDialogOpen
	};
}
