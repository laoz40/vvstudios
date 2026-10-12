"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		yield* sendSessionHostDetailsEmail(buildBookingReceiptHostEmailArgs(options, receipt)).orElse(
			(error: { reason: string }) => logBookingReceiptHostEmailFailure(booking._id, error)
		);

		return ok({ receiptNumber: receipt.artifacts.data.receipt.number });
	});
}

function sendPackageReceiptHostEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: PackageReceiptEmailOptions,
	receipt: PackageReceiptArtifacts
) {
	return safeTry(async function* () {
		yield* sendPackageHostDetailsEmail(
			buildPackageReceiptHostEmailArgs(packageRecord, paidAt, options, receipt)
		).orElse((error: { reason: string }) =>
			logPackageReceiptHostEmailFailure(packageRecord._id, error)
		);

		return ok({ receiptNumber: receipt.artifacts.data.receipt.number });
	});
}

export function sendBookingReceiptEmailsForBooking(
	booking: Doc<"bookings">,
	options: BookingReceiptEmailOptions
): ResultAsync<{ receiptNumber: string }, BookingReceiptEmailError> {
	return safeTry(async function* () {
		const receipt = yield* createBookingReceiptArtifacts(booking, options);
		const receiptWithPdf = yield* attachPdfToBookingReceiptArtifacts(receipt);
		const sentReceipt = yield* sendBookingReceiptCustomerEmail(booking, receiptWithPdf);
		const result = yield* sendBookingReceiptHostEmail(booking, options, sentReceipt);

		return ok(result);
	});
}

export function sendPackageReceiptEmailsForPackage(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: PackageReceiptEmailOptions
): ResultAsync<{ receiptNumber: string }, PackageReceiptEmailError> {
	return safeTry(async function* () {
		const receipt = yield* createPackageReceiptArtifacts(packageRecord, paidAt, options);
		const receiptWithPdf = yield* attachPdfToPackageReceiptArtifacts(receipt);

		const sentReceipt = yield* sendPackageReceiptCustomerEmail(
			packageRecord,
			paidAt,
			receiptWithPdf
		);

		const result = yield* sendPackageReceiptHostEmail(packageRecord, paidAt, options, sentReceipt);

		return ok(result);
	});
}
