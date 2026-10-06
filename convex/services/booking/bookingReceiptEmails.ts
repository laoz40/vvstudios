import { ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	createBookingReceiptEmailArtifactsForBooking,
	createPackageReceiptEmailArtifacts,
	type PackageInvoiceInput
} from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	attachPdfToBookingReceiptArtifacts,
	attachPdfToPackageReceiptArtifacts,
	bookingReceiptNumberFromArtifacts,
	type BookingReceiptCustomerSentStep,
	type PackageReceiptArtifactsStep
} from "#convex/lib/booking/bookingReceiptEmailPipeline";
import {
	sendBookingReceiptCustomerEmail,
	sendPackageReceiptCustomerEmail
} from "#convex/lib/booking/bookingReceiptEmailPipeline";
import { formatTimestampDateLong } from "#convex/lib/email/emailSend";
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

export type PackageReceiptEmailError = {
	reason:
		| "EMAIL_REQUEST_FAILED"
		| "EMAIL_RESPONSE_FAILED"
		| "INVALID_BOOKING_DATA"
		| "RECEIPT_EMAIL_RENDER_FAILED"
		| "RECEIPT_PDF_RENDER_FAILED";
};

function bookingPaidAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

function logBookingReceiptHostEmailFailure(
	bookingId: Doc<"bookings">["_id"],
	error: { reason: string }
) {
	console.error("Booking receipt host email send failed", { bookingId, reason: error.reason });

	return ok(null);
}

function maybeSendBookingReceiptHostEmail(
	booking: Doc<"bookings">,
	options: { reschedule?: SessionHostRescheduleDetails; skipHostEmail?: boolean },

	{ artifacts, parsedBooking }: BookingReceiptCustomerSentStep
) {
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
		.orElse((error: { reason: string }) => logBookingReceiptHostEmailFailure(booking._id, error))
		.map(() => ({ receiptNumber }));
}

function logPackageReceiptHostEmailFailure(
	packageId: PackageInvoiceInput["_id"],
	error: { reason: string }
) {
	console.error("Package receipt host email send failed", { packageId, reason: error.reason });

	return ok(null);
}

function maybeSendPackageReceiptHostEmail(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { skipHostEmail?: boolean },

	{ artifacts }: { artifacts: PackageReceiptArtifactsStep["artifacts"] }
) {
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
		.orElse((error: { reason: string }) =>
			logPackageReceiptHostEmailFailure(packageRecord._id, error)
		)
		.map(() => ({ receiptNumber }));
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
		.andThen((_value) => maybeSendBookingReceiptHostEmail(booking, options, _value));
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
		.andThen((_value) => maybeSendPackageReceiptHostEmail(packageRecord, paidAt, options, _value));
}
