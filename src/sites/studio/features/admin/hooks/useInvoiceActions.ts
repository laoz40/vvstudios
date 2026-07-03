import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SendBookingInvoiceForBookingResult } from "#convex/googleCalendar";
import type { GetAdminMultiBookingInvoicePdfByIdResult } from "#convex/invoices";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

export function useInvoiceActions(booking: BookingRecord) {
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminMultiBookingInvoicePdfById);
	const [isEmailInvoiceDialogOpen, setIsEmailInvoiceDialogOpen] = useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);
	const [isEmailingInvoice, setIsEmailingInvoice] = useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		if (booking.multiBookingPackageId) {
			const [packageError, invoice] = await tryCatch<GetAdminMultiBookingInvoicePdfByIdResult>(
				getAdminPackageInvoicePdf({ multiBookingId: booking.multiBookingPackageId })
			);

			setIsDownloadingInvoice(false);

			if (packageError !== null) {
				toast.error("Unable to generate package invoice.");
				return;
			}

			downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
			toast.success("Package invoice download started.");
			return;
		}

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({ booking, createdAt: booking.pendingPaymentCreatedAt })
		);

		setIsDownloadingInvoice(false);

		if (error !== null) {
			switch (error.reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(error.message);
					return;
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");
					return;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}
		}

		toast.success("Invoice download started.");
	}

	async function handleEmailInvoice() {
		setIsEmailingInvoice(true);

		const [error] = await tryCatch<SendBookingInvoiceForBookingResult>(
			sendBookingInvoiceForBooking({ bookingId: booking._id })
		);

		setIsEmailingInvoice(false);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					return;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send invoice emails.");
					return;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					return;
				case "INVOICE_SEND_FAILED":
					toast.error("Unable to send invoice email.");
					return;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice email.");
					return;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}
		}

		setIsEmailInvoiceDialogOpen(false);
		toast.success(`Invoice sent to ${booking.email}.`);
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
