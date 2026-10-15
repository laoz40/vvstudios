import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import type { Doc } from "#convex/_generated/dataModel";
import { sendEmail } from "#convex/shared/lib/email/emailSend";
import {
	formatTimestampDateLong,
	formatTimestampDateShort
} from "#convex/shared/lib/email/emailSend";
import {
	createBookingReceiptEmailArtifactsForBooking,
	createPackageReceiptEmailArtifacts,
	type PackageInvoiceInput
} from "#studio/features/booking-invoice/lib/booking-artifacts";
import { formatSessionDateShort } from "#convex/sessions/lib/calendarTime";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import type {
	SendPackageHostDetailsEmailArgs,
	SendSessionHostDetailsEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { renderBookingReceiptPdfInNode } from "#convex/booking/lib/invoicePdfRender";

export type ReceiptEmailArtifacts = {
	data: Parameters<typeof renderBookingReceiptPdfInNode>[0];
	emailHtml: string;
	pdf: { contentType: string; filename: string };
};

export type BookingReceiptArtifacts = {
	artifacts: ReceiptEmailArtifacts;
	booking: BookingFormValues;
};

export type RenderedBookingReceipt = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
	pdfContent: Uint8Array;
};

export type SentBookingReceipt = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
};

export type SessionHostRescheduleDetails = { originalDate: string; originalTime: string };

export type BookingReceiptEmailOptions = {
	leadTimeMinutes: number;
	reschedule?: SessionHostRescheduleDetails;
	rescheduleUrl?: string;
	skipHostEmail?: boolean;
};

export type PackageReceiptEmailOptions = {
	expiresAt?: number;
	leadTimeMinutes: number;
	scheduleUrl: string;
	skipHostEmail?: boolean;
};

export type PackageReceiptArtifacts = { artifacts: ReceiptEmailArtifacts };

export type RenderedPackageReceipt = { artifacts: ReceiptEmailArtifacts; pdfContent: Uint8Array };

export function createBookingReceiptArtifacts(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
) {
	return createBookingReceiptEmailArtifactsForBooking(booking, bookingPaidAt(booking), options);
}

export function createPackageReceiptArtifacts(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: {
		expiresAt?: number;
		leadTimeMinutes: number;
		scheduleUrl: string;
		skipHostEmail?: boolean;
	}
) {
	const { expiresAt, ...artifactOptions } = options;

	return createPackageReceiptEmailArtifacts(packageRecord, paidAt, {
		...artifactOptions,
		scheduleExpiresAtLabel: expiresAt === undefined ? undefined : formatTimestampDateLong(expiresAt)
	});
}

export function bookingPaidAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

export function sendBookingReceiptCustomerEmail(
	booking: Doc<"bookings">,
	receipt: RenderedBookingReceipt
) {
	return sendEmail({
		to: [booking.email],
		subject: "Studio booking confirmed - " + formatSessionDateShort(booking.date),
		html: receipt.artifacts.emailHtml,
		attachments: [{ ...receipt.artifacts.pdf, content: receipt.pdfContent }],
		logContext: { operation: "email.sendBookingReceipt", bookingId: booking._id }
	}).map(() => ({ artifacts: receipt.artifacts, parsedBooking: receipt.parsedBooking }));
}

export function sendPackageReceiptCustomerEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	receipt: RenderedPackageReceipt
) {
	return sendEmail({
		to: [packageRecord.email],
		subject:
			"Your " +
			packageRecord.packageSize +
			"-Session Package confirmed — schedule your sessions (" +
			formatTimestampDateShort(paidAt) +
			")",
		html: receipt.artifacts.emailHtml,
		attachments: [{ ...receipt.artifacts.pdf, content: receipt.pdfContent }],
		logContext: { operation: "email.sendPackageReceipt", packageId: packageRecord._id }
	}).map(() => ({ artifacts: receipt.artifacts }));
}

export function attachPdfToBookingReceiptArtifacts(receipt: BookingReceiptArtifacts) {
	return renderBookingReceiptPdfInNode(receipt.artifacts.data).map((pdfContent) => ({
		artifacts: receipt.artifacts,
		parsedBooking: receipt.booking,
		pdfContent
	}));
}

export function attachPdfToPackageReceiptArtifacts(receipt: PackageReceiptArtifacts) {
	return renderBookingReceiptPdfInNode(receipt.artifacts.data).map((pdfContent) => ({
		artifacts: receipt.artifacts,
		pdfContent
	}));
}

export function buildBookingReceiptHostEmailArgs(
	bookingId: Doc<"bookings">["_id"],
	options: { reschedule?: SessionHostRescheduleDetails; skipHostEmail?: boolean },
	receipt: SentBookingReceipt
): SendSessionHostDetailsEmailArgs | null {
	const receiptNumber = receipt.artifacts.data.receipt.number;
	const bookingForHost = receipt.parsedBooking;

	if (options.skipHostEmail) return null;

	return {
		bookingId,
		invoiceNumber: receiptNumber,
		name: bookingForHost.name,
		email: bookingForHost.email,
		phone: bookingForHost.phone,
		accountName: bookingForHost.accountName,
		abn: bookingForHost.abn,
		date: bookingForHost.date,
		time: bookingForHost.time,
		service: bookingForHost.service,
		duration: bookingForHost.duration,
		addons: bookingForHost.addons,
		notes: bookingForHost.notes,
		reschedule: options.reschedule,
		...pickBookingAddonQuantities(bookingForHost)
	};
}

export function buildPackageReceiptHostEmailArgs(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { skipHostEmail?: boolean },
	receipt: PackageReceiptArtifacts
): SendPackageHostDetailsEmailArgs | null {
	if (options.skipHostEmail) return null;

	return {
		packageId: packageRecord._id,
		invoiceNumber: receipt.artifacts.data.receipt.number,
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
	};
}
