import { ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	createBookingReceiptEmailArtifactsForBooking,
	createPackageReceiptEmailArtifacts,
	type PackageInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
import { renderBookingReceiptPdfInNode } from "#convex/lib/bookingInvoicePdfRender";
import { formatTimestampDateShort, sendEmail } from "#convex/lib/emailSend";
import { sendPackageHostDetailsEmail, sendSessionHostDetailsEmail } from "#convex/lib/email";
import { formatSessionDateShort } from "#convex/lib/sessionCalendarTime";

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

function bookingPaidAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

export function sendBookingReceiptEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		leadTimeMinutes: number;
		reschedule?: SessionHostRescheduleDetails;
		rescheduleUrl?: string;
		skipHostEmail?: boolean;
	}
): ResultAsync<null, BookingReceiptEmailError> {
	return createBookingReceiptEmailArtifactsForBooking(booking, bookingPaidAt(booking), {
		leadTimeMinutes: options.leadTimeMinutes,
		rescheduleUrl: options.rescheduleUrl
	})
		.andThen(({ artifacts, booking: parsedBooking }) =>
			renderBookingReceiptPdfInNode(artifacts.data).map((pdfContent) => ({
				artifacts,
				parsedBooking,
				pdfContent
			}))
		)
		.andThen(({ artifacts, parsedBooking, pdfContent }) =>
			sendEmail({
				to: [booking.email],
				subject: `Studio booking confirmed - ${formatSessionDateShort(booking.date)}`,
				html: artifacts.emailHtml,
				attachments: [{ ...artifacts.pdf, content: pdfContent }]
			}).map(() => ({ artifacts, parsedBooking }))
		)
		.andThen(({ artifacts, parsedBooking }) => {
			if (options.skipHostEmail) {
				return okAsync(null);
			}

			return sendSessionHostDetailsEmail({
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
			}).orElse((error) => {
				console.error("Booking receipt host email send failed", {
					bookingId: booking._id,
					reason: error.reason
				});

				return ok(null);
			});
		});
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
	return createPackageReceiptEmailArtifacts(packageRecord, paidAt, options)
		.andThen(({ artifacts }) =>
			renderBookingReceiptPdfInNode(artifacts.data).map((pdfContent) => ({ artifacts, pdfContent }))
		)
		.andThen(({ artifacts, pdfContent }) =>
			sendEmail({
				to: [packageRecord.email],
				subject: `Your ${packageRecord.packageSize}-Session Package confirmed — schedule your sessions (${formatTimestampDateShort(paidAt)})`,
				html: artifacts.emailHtml,
				attachments: [{ ...artifacts.pdf, content: pdfContent }]
			}).map(() => ({ artifacts }))
		)
		.andThen(({ artifacts }) => {
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
				.orElse((error) => {
					console.error("Package receipt host email send failed", {
						packageId: packageRecord._id,
						reason: error.reason
					});

					return ok(null);
				})
				.map(() => ({ receiptNumber }));
		});
}
