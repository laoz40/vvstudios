import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	createBookingReceiptEmailArtifactsForBooking,
	createPackageAdjustmentReceiptEmailArtifacts,
	createPackageReceiptEmailArtifacts,
	renderBookingInvoicePdfInNode,
	renderBookingReceiptPdfInNode,
	type PackageAdjustmentInvoiceInput,
	type PackageInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
import { formatTimestampDateShort, sendEmail } from "#convex/lib/emailSend";
import { sendPackageHostDetailsEmail, sendSessionHostDetailsEmail } from "#convex/lib/email";
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

export async function sendPackageReceiptEmailsForPackage(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { leadTimeMinutes: number; skipHostEmail?: boolean }
): Promise<
	Result<
		{ receiptNumber: string },
		{ reason: "INVALID_BOOKING_DATA" | "RECEIPT_EMAIL_RENDER_FAILED" | "RECEIPT_SEND_FAILED" }
	>
> {
	const artifactsResult = await createPackageReceiptEmailArtifacts(packageRecord, paidAt, options);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts } = artifactsResult.value;
	const pdfResult = await renderBookingReceiptPdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Package receipt PDF render failed", { packageId: packageRecord._id });

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	const receiptEmailResult = await sendEmail({
		to: [packageRecord.email],
		subject: `Your ${packageRecord.packageSize}-Session Package confirmed - ${formatTimestampDateShort(paidAt)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }]
	});

	if (receiptEmailResult.isErr()) {
		console.error("Package receipt customer email send failed", {
			packageEmail: packageRecord.email,
			packageId: packageRecord._id,
			reason: receiptEmailResult.error.reason
		});

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	if (!options.skipHostEmail) {
		const hostEmailResult = await sendPackageHostDetailsEmail({
			invoiceNumber: artifacts.data.receipt.number,
			name: packageRecord.name,
			email: packageRecord.email,
			phone: packageRecord.phone,
			accountName: packageRecord.accountName,
			abn: packageRecord.abn,
			duration: packageRecord.duration,
			addons: packageRecord.addons,
			essentialEditQuantity: packageRecord.essentialEditQuantity,
			completeEditQuantity: packageRecord.completeEditQuantity,
			clipsPackageQuantity: packageRecord.clipsPackageQuantity,
			handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity,
			notes: packageRecord.notes,
			packageSize: packageRecord.packageSize,
			invoiceDueAt: paidAt
		});

		if (hostEmailResult.isErr()) {
			console.error("Package receipt host email send failed", {
				packageId: packageRecord._id,
				reason: hostEmailResult.error.reason
			});
		}
	}

	return ok({ receiptNumber: artifacts.data.receipt.number });
}

export async function sendPackageAdjustmentReceiptEmails(
	invoiceInput: PackageAdjustmentInvoiceInput,
	paidAt: number,
	leadTimeMinutes: number
): Promise<
	Result<
		{ receiptNumber: string },
		{ reason: "INVALID_BOOKING_DATA" | "RECEIPT_EMAIL_RENDER_FAILED" | "RECEIPT_SEND_FAILED" }
	>
> {
	const artifactsResult = await createPackageAdjustmentReceiptEmailArtifacts(
		invoiceInput,
		paidAt,
		leadTimeMinutes
	);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts } = artifactsResult.value;
	const pdfResult = await renderBookingReceiptPdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Package adjustment receipt PDF render failed", {
			adjustmentId: invoiceInput.adjustment._id
		});

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	const receiptEmailResult = await sendEmail({
		to: [invoiceInput.packageRecord.email],
		subject: `Your Remote Podcast Adjustment Receipt — Package Booked on ${formatTimestampDateShort(invoiceInput.packageRecord.createdAt)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }],
		idempotencyKey: `package-adjustment-receipt-${invoiceInput.adjustment._id}`
	});

	if (receiptEmailResult.isErr()) {
		console.error("Package adjustment receipt customer email send failed", {
			adjustmentId: invoiceInput.adjustment._id,
			packageEmail: invoiceInput.packageRecord.email,
			reason: receiptEmailResult.error.reason
		});

		return err({ reason: "RECEIPT_SEND_FAILED" });
	}

	return ok({ receiptNumber: artifacts.data.receipt.number });
}
