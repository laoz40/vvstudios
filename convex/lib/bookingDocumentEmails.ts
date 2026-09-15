import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	createBookingReceiptEmailArtifactsForBooking,
	renderBookingInvoicePdfInNode,
	renderBookingReceiptPdfInNode
} from "#convex/lib/bookingInvoiceArtifacts";
import { sendEmail } from "#convex/lib/emailSend";
import { sendSessionHostDetailsEmail } from "#convex/lib/email";
import { formatSessionDateShort } from "#convex/lib/sessionCalendarTime";

interface SessionHostRescheduleDetails {
	originalDate: string;
	originalTime: string;
}

export async function sendBookingInvoiceEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		customInvoice?: Doc<"customInvoices">;
		leadTimeMinutes: number;
		rescheduleUrl?: string;
		skipHostEmail?: boolean;
	}
): Promise<
	Result<
		null,
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" | "INVOICE_SEND_FAILED" }
	>
> {
	const artifactsResult = await createBookingInvoiceEmailArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		options
	);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult.value;
	const pdfResult = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Booking invoice PDF render failed", { bookingId: booking._id });

		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const pdfContent = pdfResult.value;

	const invoiceEmailResult = await sendEmail({
		to: [booking.email],
		subject: `Your Studio Booking Invoice - ${formatSessionDateShort(booking.date)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfContent }]
	});

	if (invoiceEmailResult.isErr()) {
		console.error("Booking invoice customer email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			reason: invoiceEmailResult.error.reason
		});

		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	if (!options.skipHostEmail) {
		const hostEmailResult = await sendSessionHostDetailsEmail({
			invoiceNumber: artifacts.data.invoice.number,
			name: parsedBooking.name,
			email: parsedBooking.email,
			phone: parsedBooking.phone,
			accountName: parsedBooking.accountName,
			abn: parsedBooking.abn,
			date: parsedBooking.date,
			time: parsedBooking.time,
			service: parsedBooking.service,
			duration: parsedBooking.duration,
			addons: parsedBooking.addons,
			notes: parsedBooking.notes
		});

		if (hostEmailResult.isErr()) {
			console.error("Booking invoice host email send failed", {
				bookingId: booking._id,
				reason: hostEmailResult.error.reason
			});
		}
	}

	return ok(null);
}

export async function sendBookingReceiptEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		leadTimeMinutes: number;
		reschedule?: SessionHostRescheduleDetails;
		rescheduleUrl?: string;
		skipHostEmail?: boolean;
	}
): Promise<
	Result<
		null,
		{ reason: "INVALID_BOOKING_DATA" | "RECEIPT_EMAIL_RENDER_FAILED" | "RECEIPT_SEND_FAILED" }
	>
> {
	const artifactsResult = await createBookingReceiptEmailArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		options
	);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult.value;
	const pdfResult = await renderBookingReceiptPdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Booking receipt PDF render failed", { bookingId: booking._id });

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	const receiptEmailResult = await sendEmail({
		to: [booking.email],
		subject: `Studio booking confirmed - ${formatSessionDateShort(booking.date)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }]
	});

	if (receiptEmailResult.isErr()) {
		console.error("Booking receipt customer email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			reason: receiptEmailResult.error.reason
		});

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	if (!options.skipHostEmail) {
		const hostEmailResult = await sendSessionHostDetailsEmail({
			invoiceNumber: artifacts.data.receipt.number,
			name: parsedBooking.name,
			email: parsedBooking.email,
			phone: parsedBooking.phone,
			accountName: parsedBooking.accountName,
			abn: parsedBooking.abn,
			date: parsedBooking.date,
			time: parsedBooking.time,
			service: parsedBooking.service,
			duration: parsedBooking.duration,
			addons: parsedBooking.addons,
			notes: parsedBooking.notes,
			reschedule: options.reschedule
		});

		if (hostEmailResult.isErr()) {
			console.error("Booking receipt host email send failed", {
				bookingId: booking._id,
				reason: hostEmailResult.error.reason
			});
		}
	}

	return ok(null);
}
