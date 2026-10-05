import { ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	createBookingReceiptEmailArtifactsForBooking,
	createPackageReceiptEmailArtifacts,
	type PackageInvoiceInput
} from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import { renderBookingReceiptPdfInNode } from "#convex/lib/booking/bookingInvoicePdfRender";
import {
	formatTimestampDateLong,
	formatTimestampDateShort,
	sendEmail
} from "#convex/lib/email/emailSend";
import { formatSessionDateShort } from "#convex/lib/sessions/sessionCalendarTime";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import {
	sendPackageHostDetailsEmail,
	sendSessionHostDetailsEmail
} from "#convex/services/email/hostBookingEmails";

interface SessionHostRescheduleDetails {
	originalDate: string;
	originalTime: string;
}

type BookingReceiptEmailError = {
	reason:
		| "EMAIL_REQUEST_FAILED"
		| "EMAIL_RESPONSE_FAILED"
		| "INVALID_BOOKING_DATA"
		| "RECEIPT_EMAIL_RENDER_FAILED"
		| "RECEIPT_PDF_RENDER_FAILED";
};

type PackageReceiptEmailError = {
	reason:
		| "EMAIL_REQUEST_FAILED"
		| "EMAIL_RESPONSE_FAILED"
		| "INVALID_BOOKING_DATA"
		| "RECEIPT_EMAIL_RENDER_FAILED"
		| "RECEIPT_PDF_RENDER_FAILED";
};

type ReceiptEmailArtifacts = {
	data: Parameters<typeof renderBookingReceiptPdfInNode>[0];
	emailHtml: string;
	pdf: { contentType: string; filename: string };
};

type BookingReceiptArtifactsStep = { artifacts: ReceiptEmailArtifacts; booking: BookingFormValues };

type BookingReceiptRenderedStep = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
	pdfContent: Uint8Array;
};

type BookingReceiptCustomerSentStep = {
	artifacts: ReceiptEmailArtifacts;
	parsedBooking: BookingFormValues;
};

type PackageReceiptArtifactsStep = { artifacts: ReceiptEmailArtifacts };

type PackageReceiptRenderedStep = { artifacts: ReceiptEmailArtifacts; pdfContent: Uint8Array };

function bookingPaidAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

function withRenderedBookingPdf({
	artifacts,
	booking: parsedBooking
}: BookingReceiptArtifactsStep) {
	return (pdfContent: Uint8Array) => ({ artifacts, parsedBooking, pdfContent });
}

function attachPdfToBookingReceiptArtifacts(step: BookingReceiptArtifactsStep) {
	return renderBookingReceiptPdfInNode(step.artifacts.data).map(withRenderedBookingPdf(step));
}

function sendBookingReceiptCustomerEmail(booking: Doc<"bookings">) {
	return ({ artifacts, parsedBooking, pdfContent }: BookingReceiptRenderedStep) =>
		sendEmail({
			to: [booking.email],
			subject: `Studio booking confirmed - ${formatSessionDateShort(booking.date)}`,
			html: artifacts.emailHtml,
			attachments: [{ ...artifacts.pdf, content: pdfContent }]
		}).map(customerEmailSentArtifacts(artifacts, parsedBooking));
}

function customerEmailSentArtifacts(
	artifacts: BookingReceiptArtifactsStep["artifacts"],
	parsedBooking: BookingReceiptArtifactsStep["booking"]
) {
	return () => ({ artifacts, parsedBooking });
}

function bookingReceiptNumberFromArtifacts({
	artifacts,
	parsedBooking
}: BookingReceiptCustomerSentStep) {
	return { receiptNumber: artifacts.data.receipt.number, parsedBooking };
}

function logBookingReceiptHostEmailFailure(bookingId: Doc<"bookings">["_id"]) {
	return (error: { reason: string }) => {
		console.error("Booking receipt host email send failed", { bookingId, reason: error.reason });

		return ok(null);
	};
}

function receiptNumberResult(receiptNumber: string) {
	return () => ({ receiptNumber });
}

function maybeSendBookingReceiptHostEmail(
	booking: Doc<"bookings">,
	options: { reschedule?: SessionHostRescheduleDetails; skipHostEmail?: boolean }
) {
	return ({ artifacts, parsedBooking }: BookingReceiptCustomerSentStep) => {
		const { receiptNumber, parsedBooking: bookingForHost } = bookingReceiptNumberFromArtifacts({
			artifacts,
			parsedBooking
		});

		if (options.skipHostEmail) {
			return okAsync({ receiptNumber });
		}

		return sendSessionHostDetailsEmail({
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
		})
			.orElse(logBookingReceiptHostEmailFailure(booking._id))
			.map(receiptNumberResult(receiptNumber));
	};
}

function withRenderedPackagePdf({ artifacts }: PackageReceiptArtifactsStep) {
	return (pdfContent: Uint8Array) => ({ artifacts, pdfContent });
}

function attachPdfToPackageReceiptArtifacts(step: PackageReceiptArtifactsStep) {
	return renderBookingReceiptPdfInNode(step.artifacts.data).map(withRenderedPackagePdf(step));
}

function sendPackageReceiptCustomerEmail(packageRecord: PackageInvoiceInput, paidAt: number) {
	return ({ artifacts, pdfContent }: PackageReceiptRenderedStep) =>
		sendEmail({
			to: [packageRecord.email],
			subject: `Your ${packageRecord.packageSize}-Session Package confirmed — schedule your sessions (${formatTimestampDateShort(paidAt)})`,
			html: artifacts.emailHtml,
			attachments: [{ ...artifacts.pdf, content: pdfContent }]
		}).map(packageCustomerEmailSentArtifacts(artifacts));
}

function packageCustomerEmailSentArtifacts(artifacts: PackageReceiptArtifactsStep["artifacts"]) {
	return () => ({ artifacts });
}

function logPackageReceiptHostEmailFailure(packageId: PackageInvoiceInput["_id"]) {
	return (error: { reason: string }) => {
		console.error("Package receipt host email send failed", { packageId, reason: error.reason });

		return ok(null);
	};
}

function maybeSendPackageReceiptHostEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { skipHostEmail?: boolean }
) {
	return ({ artifacts }: { artifacts: PackageReceiptArtifactsStep["artifacts"] }) => {
		const receiptNumber = artifacts.data.receipt.number;

		if (options.skipHostEmail) {
			return okAsync({ receiptNumber });
		}

		return sendPackageHostDetailsEmail({
			invoiceNumber: receiptNumber,
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
		})
			.orElse(logPackageReceiptHostEmailFailure(packageRecord._id))
			.map(receiptNumberResult(receiptNumber));
	};
}

export function sendBookingReceiptEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		leadTimeMinutes: number;
		reschedule?: SessionHostRescheduleDetails;
		rescheduleUrl?: string;
		skipHostEmail?: boolean;
	}
): ResultAsync<{ receiptNumber: string }, BookingReceiptEmailError> {
	return createBookingReceiptEmailArtifactsForBooking(booking, bookingPaidAt(booking), {
		leadTimeMinutes: options.leadTimeMinutes,
		rescheduleUrl: options.rescheduleUrl
	})
		.andThen(attachPdfToBookingReceiptArtifacts)
		.andThen(sendBookingReceiptCustomerEmail(booking))
		.andThen(maybeSendBookingReceiptHostEmail(booking, options));
}

export function sendPackageReceiptEmailsForPackage(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: {
		expiresAt?: number;
		leadTimeMinutes: number;
		scheduleUrl: string;
		skipHostEmail?: boolean;
	}
): ResultAsync<{ receiptNumber: string }, PackageReceiptEmailError> {
	const { expiresAt, ...artifactOptions } = options;

	return createPackageReceiptEmailArtifacts(packageRecord, paidAt, {
		...artifactOptions,
		scheduleExpiresAtLabel: expiresAt === undefined ? undefined : formatTimestampDateLong(expiresAt)
	})
		.andThen(attachPdfToPackageReceiptArtifacts)
		.andThen(sendPackageReceiptCustomerEmail(packageRecord, paidAt))
		.andThen(maybeSendPackageReceiptHostEmail(packageRecord, paidAt, options));
}
