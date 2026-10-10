import type { Doc } from "#convex/_generated/dataModel";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { renderBookingReceiptPdfInNode } from "#convex/booking/lib/bookingInvoicePdfRender";
import { formatTimestampDateShort, sendEmail } from "#convex/shared/lib/email/emailSend";
import { formatSessionDateShort } from "#convex/sessions/lib/sessionCalendarTime";

export type ReceiptEmailArtifacts = {
	data: Parameters<typeof renderBookingReceiptPdfInNode>[0];
	emailHtml: string;
	pdf: { contentType: string; filename: string };
};

export type BookingReceiptArtifactsStep = {
	artifacts: ReceiptEmailArtifacts;
	booking: BookingFormValues;
};

export type BookingReceiptRenderedStep = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
	pdfContent: Uint8Array;
};

export type BookingReceiptCustomerSentStep = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
};

export type PackageReceiptArtifactsStep = { artifacts: ReceiptEmailArtifacts };

export type PackageReceiptRenderedStep = {
	artifacts: ReceiptEmailArtifacts;
	pdfContent: Uint8Array;
};

export function attachPdfToBookingReceiptArtifacts(step: BookingReceiptArtifactsStep) {
	return renderBookingReceiptPdfInNode(step.artifacts.data).map((pdfContent) => ({
		artifacts: step.artifacts,
		parsedBooking: step.booking,
		pdfContent
	}));
}

export function attachPdfToPackageReceiptArtifacts(step: PackageReceiptArtifactsStep) {
	return renderBookingReceiptPdfInNode(step.artifacts.data).map((pdfContent) => ({
		artifacts: step.artifacts,
		pdfContent
	}));
}

export function bookingReceiptNumberFromArtifacts({
	artifacts,
	parsedBooking
}: BookingReceiptCustomerSentStep) {
	return { receiptNumber: artifacts.data.receipt.number, parsedBooking };
}

export function sendBookingReceiptCustomerEmail(
	booking: Doc<"bookings">,
	step: BookingReceiptRenderedStep
) {
	return sendEmail({
		to: [booking.email],
		subject: `Studio booking confirmed - ${formatSessionDateShort(booking.date)}`,
		html: step.artifacts.emailHtml,
		attachments: [{ ...step.artifacts.pdf, content: step.pdfContent }]
	}).map(() => ({ artifacts: step.artifacts, parsedBooking: step.parsedBooking }));
}

export function sendPackageReceiptCustomerEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	step: PackageReceiptRenderedStep
) {
	return sendEmail({
		to: [packageRecord.email],
		subject: `Your ${packageRecord.packageSize}-Session Package confirmed — schedule your sessions (${formatTimestampDateShort(paidAt)})`,
		html: step.artifacts.emailHtml,
		attachments: [{ ...step.artifacts.pdf, content: step.pdfContent }]
	}).map(() => ({ artifacts: step.artifacts }));
}
