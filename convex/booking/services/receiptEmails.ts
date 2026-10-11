"use node";

import type { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	attachPdfToBookingReceiptArtifacts,
	attachPdfToPackageReceiptArtifacts,
	buildBookingReceiptHostEmailArgs,
	buildPackageReceiptHostEmailArgs,
	createBookingReceiptArtifacts,
	createPackageReceiptArtifacts,
	logBookingReceiptHostEmailFailure,
	logPackageReceiptHostEmailFailure,
	sendBookingReceiptCustomerEmail,
	sendPackageReceiptCustomerEmail,
	type SentBookingReceipt,
	type BookingReceiptEmailOptions,
	type PackageReceiptArtifacts,
	type PackageReceiptEmailOptions
} from "#convex/booking/lib/receiptEmailPipeline";
import {
	sendPackageHostDetailsEmail,
	sendSessionHostDetailsEmail
} from "#convex/email/services/hostBookingEmails";

type BookingReceiptEmailError = {
	reason:
		| "EMAIL_REQUEST_FAILED"
		| "EMAIL_RESPONSE_FAILED"
		| "INVALID_BOOKING_DATA"
		| "RECEIPT_EMAIL_RENDER_FAILED"
		| "RECEIPT_PDF_RENDER_FAILED";
};

export type PackageReceiptEmailError = {
	reason:
		| "EMAIL_REQUEST_FAILED"
		| "EMAIL_RESPONSE_FAILED"
		| "INVALID_BOOKING_DATA"
		| "RECEIPT_EMAIL_RENDER_FAILED"
		| "RECEIPT_PDF_RENDER_FAILED";
};

function sendBookingReceiptHostEmail(
	booking: Doc<"bookings">,
	options: BookingReceiptEmailOptions,
	receipt: SentBookingReceipt
) {
	return sendSessionHostDetailsEmail(buildBookingReceiptHostEmailArgs(options, receipt))
		.orElse((error: { reason: string }) => logBookingReceiptHostEmailFailure(booking._id, error))
		.map(() => ({ receiptNumber: receipt.artifacts.data.receipt.number }));
}

function sendPackageReceiptHostEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: PackageReceiptEmailOptions,
	receipt: PackageReceiptArtifacts
) {
	return sendPackageHostDetailsEmail(
		buildPackageReceiptHostEmailArgs(packageRecord, paidAt, options, receipt)
	)
		.orElse((error: { reason: string }) =>
			logPackageReceiptHostEmailFailure(packageRecord._id, error)
		)
		.map(() => ({ receiptNumber: receipt.artifacts.data.receipt.number }));
}

export function sendBookingReceiptEmailsForBooking(
	booking: Doc<"bookings">,
	options: BookingReceiptEmailOptions
): ResultAsync<{ receiptNumber: string }, BookingReceiptEmailError> {
	return createBookingReceiptArtifacts(booking, options)
		.andThen(attachPdfToBookingReceiptArtifacts)
		.andThen((receipt) => sendBookingReceiptCustomerEmail(booking, receipt))
		.andThen((receipt) => sendBookingReceiptHostEmail(booking, options, receipt));
}

export function sendPackageReceiptEmailsForPackage(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: PackageReceiptEmailOptions
): ResultAsync<{ receiptNumber: string }, PackageReceiptEmailError> {
	return createPackageReceiptArtifacts(packageRecord, paidAt, options)
		.andThen(attachPdfToPackageReceiptArtifacts)
		.andThen((receipt) => sendPackageReceiptCustomerEmail(packageRecord, paidAt, receipt))
		.andThen((receipt) => sendPackageReceiptHostEmail(packageRecord, paidAt, options, receipt));
}
