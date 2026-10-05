"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	createBookingInvoiceArtifactsForBooking,
	createBookingReceiptArtifactsForBooking,
	createPackageReceiptArtifacts
} from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	renderBookingInvoicePdfInNode,
	renderBookingReceiptPdfInNode
} from "#convex/lib/booking/bookingInvoicePdfRender";
import { getPackageForAction } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import {
	toInvoicePdfPayload,
	validateBookingInvoiceDownload,
	validatePackageReceiptDownload,
	type InvoicePdfPayload
} from "#convex/lib/stripe/invoiceDownloads";

export type BookingInvoicePdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "INVOICE_PDF_RENDER_FAILED" };

export type BookingReceiptPdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "RECEIPT_PDF_RENDER_FAILED" };

export type AdminPackageReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" };

export type AdminBookingReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_CONFIRMED" };

export type PublicPackageReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" };

type BookingSettingsSnapshot = { leadTimeMinutes: number };

type PublicBookingDownload = { booking: Doc<"bookings">; downloadCreatedAt: number };

type AdminBookingReceiptContext = { booking: Doc<"bookings">; receiptCreatedAt: number };

type AdminPackageReceiptContext = { packageRecord: Doc<"packages">; receiptCreatedAt: number };

function isPaidPackageStatus(status: Doc<"packages">["status"]) {
	return status === "paid" || status === "schedule_email_failed";
}

function isConfirmedBookingStatus(status: Doc<"bookings">["status"]) {
	return status === "confirmed" || status === "email_failed";
}

function getBookingReceiptCreatedAt(booking: Doc<"bookings">) {
	return (
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt
	);
}

export function loadBookingByStripeCheckoutSession(
	ctx: ActionCtx,
	stripeSessionId: string
): ResultAsync<Doc<"bookings"> | null, never> {
	return okOrThrow(
		ctx.runQuery(internal.sessionCheckout.getSessionByStripeSessionId, { stripeSessionId })
	);
}

export function loadPublicBookingInvoiceDownload(
	ctx: ActionCtx,
	stripeSessionId: string
): ResultAsync<
	PublicBookingDownload,
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_CONFIRMED" }
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
> {
	return loadBookingByStripeCheckoutSession(ctx, stripeSessionId).andThen((booking) =>
		booking
			? validateBookingInvoiceDownload(booking, Date.now()).map(
					({ booking: validatedBooking, invoiceCreatedAt }) => ({
						booking: validatedBooking,
						downloadCreatedAt: invoiceCreatedAt
					})
				)
			: err({ reason: "BOOKING_NOT_FOUND" as const })
	);
}

export function loadBookingSettingsForPdf(
	ctx: ActionCtx
): ResultAsync<BookingSettingsSnapshot, never> {
	return okOrThrow(ctx.runQuery(api.bookingSettings.get, {}));
}

export function renderBookingReceiptPdfPayload(
	booking: Doc<"bookings">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	return createBookingReceiptArtifactsForBooking(booking, receiptCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	}).andThen((artifactsResult) =>
		renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
			toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
		)
	);
}

export function renderBookingInvoicePdfPayload(
	booking: Doc<"bookings">,
	invoiceCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingInvoicePdfError> {
	return createBookingInvoiceArtifactsForBooking(booking, invoiceCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	}).andThen((artifactsResult) =>
		renderBookingInvoicePdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
			toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
		)
	);
}

export function loadPublicPackageReceiptDownload(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<
	{ packageRecord: Doc<"packages">; receiptCreatedAt: number },
	PublicPackageReceiptPdfError
> {
	return getPackageForAction(ctx, packageId).andThen((packageRecord) =>
		validatePackageReceiptDownload(packageRecord, Date.now())
	);
}

export function renderPackageReceiptPdfPayload(
	packageRecord: Doc<"packages">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	return createPackageReceiptArtifacts(packageRecord, receiptCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	}).andThen((artifactsResult) =>
		renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
			toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
		)
	);
}

export function loadAdminBookingForReceiptPdf(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<AdminBookingReceiptContext, AdminBookingReceiptPdfError> {
	return getSessionFromQuery(ctx, bookingId).andThen((booking) => {
		if (!isConfirmedBookingStatus(booking.status)) {
			return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
		}

		const receiptCreatedAt = getBookingReceiptCreatedAt(booking);

		if (!receiptCreatedAt) {
			return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
		}

		return ok({ booking, receiptCreatedAt });
	});
}

export function loadAdminPackageForReceiptPdf(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<AdminPackageReceiptContext, AdminPackageReceiptPdfError> {
	return getPackageForAction(ctx, packageId).andThen((packageRecord) => {
		const receiptCreatedAt = packageRecord.paidAt;

		if (!isPaidPackageStatus(packageRecord.status) || !receiptCreatedAt) {
			return err({ reason: "PACKAGE_NOT_PAID" as const });
		}

		return ok({ packageRecord, receiptCreatedAt });
	});
}
