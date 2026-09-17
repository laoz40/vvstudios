"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	createBookingInvoiceArtifactsForBooking,
	createBookingReceiptArtifactsForBooking,
	createPackageReceiptArtifacts
} from "#convex/lib/bookingInvoiceArtifacts";
import {
	renderBookingInvoicePdfInNode,
	renderBookingReceiptPdfInNode
} from "#convex/lib/bookingInvoicePdfRender";
import {
	toInvoicePdfPayload,
	validateBookingInvoiceDownload,
	validatePackageReceiptDownload,
	type InvoicePdfPayload
} from "#convex/lib/invoiceDownloads";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

type BookingInvoicePdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "INVOICE_PDF_RENDER_FAILED" };

type BookingReceiptPdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "RECEIPT_PDF_RENDER_FAILED" };

type AdminPackageReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" };

type AdminBookingReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_CONFIRMED" };

type PublicPackageReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" };

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

export function getBookingReceiptPdfByStripeSessionIdService(
	ctx: ActionCtx,
	args: { stripeSessionId: string }
): ResultAsync<
	InvoicePdfPayload,
	| BookingReceiptPdfError
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_CONFIRMED" }
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
> {
	const bookingPromise: Promise<Doc<"bookings"> | null> = ctx.runQuery(
		internal.sessionCheckout.getSessionByStripeSessionId,
		{ stripeSessionId: args.stripeSessionId }
	);

	return okOrThrow(bookingPromise)
		.andThen((booking) =>
			booking
				? validateBookingInvoiceDownload(booking, Date.now())
				: err({ reason: "BOOKING_NOT_FOUND" as const })
		)
		.andThen(({ booking, invoiceCreatedAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
				booking,
				bookingSettings,
				receiptCreatedAt: invoiceCreatedAt
			}))
		)
		.andThen(({ booking, bookingSettings, receiptCreatedAt }) =>
			createBookingReceiptArtifactsForBooking(booking, receiptCreatedAt, {
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		)
		.andThen((artifactsResult) =>
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
				toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
			)
		);
}

export function getBookingInvoicePdfByStripeSessionIdService(
	ctx: ActionCtx,
	args: { stripeSessionId: string }
): ResultAsync<
	InvoicePdfPayload,
	| BookingInvoicePdfError
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_CONFIRMED" }
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
> {
	const bookingPromise: Promise<Doc<"bookings"> | null> = ctx.runQuery(
		internal.sessionCheckout.getSessionByStripeSessionId,
		{ stripeSessionId: args.stripeSessionId }
	);

	return okOrThrow(bookingPromise)
		.andThen((booking) =>
			booking
				? validateBookingInvoiceDownload(booking, Date.now())
				: err({ reason: "BOOKING_NOT_FOUND" as const })
		)
		.andThen(({ booking, invoiceCreatedAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
				booking,
				bookingSettings,
				invoiceCreatedAt
			}))
		)
		.andThen(({ booking, bookingSettings, invoiceCreatedAt }) =>
			createBookingInvoiceArtifactsForBooking(booking, invoiceCreatedAt, {
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		)
		.andThen((artifactsResult) =>
			renderBookingInvoicePdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
				toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
			)
		);
}

export function getPackageReceiptPdfByIdService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<InvoicePdfPayload, PublicPackageReceiptPdfError> {
	return getPackageForAction(ctx, args.packageId)
		.andThen((packageRecord) => validatePackageReceiptDownload(packageRecord, Date.now()))
		.andThen(({ packageRecord, receiptCreatedAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
				bookingSettings,
				packageRecord,
				receiptCreatedAt
			}))
		)
		.andThen(({ bookingSettings, packageRecord, receiptCreatedAt }) =>
			createPackageReceiptArtifacts(packageRecord, receiptCreatedAt, {
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		)
		.andThen((artifactsResult) =>
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
				toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
			)
		);
}

export function getAdminBookingReceiptPdfByBookingIdService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<InvoicePdfPayload, AdminBookingReceiptPdfError> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data")
		.andThen(() => getSessionFromQuery(ctx, args.bookingId))
		.andThen((booking) => {
			if (!isConfirmedBookingStatus(booking.status)) {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}

			const receiptCreatedAt = getBookingReceiptCreatedAt(booking);

			if (!receiptCreatedAt) {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}

			return ok({ booking, receiptCreatedAt });
		})
		.andThen(({ booking, receiptCreatedAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
				booking,
				bookingSettings,
				receiptCreatedAt
			}))
		)
		.andThen(({ booking, bookingSettings, receiptCreatedAt }) =>
			createBookingReceiptArtifactsForBooking(booking, receiptCreatedAt, {
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		)
		.andThen((artifactsResult) =>
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
				toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
			)
		);
}

export function getAdminPackageReceiptPdfByIdService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<InvoicePdfPayload, AdminPackageReceiptPdfError> {
	return requirePermissionActions(ctx, "view:sensitive-booking-data")
		.andThen(() => getPackageForAction(ctx, args.packageId))
		.andThen((packageRecord) => {
			const receiptCreatedAt = packageRecord.paidAt;

			if (!isPaidPackageStatus(packageRecord.status) || !receiptCreatedAt) {
				return err({ reason: "PACKAGE_NOT_PAID" as const });
			}

			return ok({ packageRecord, receiptCreatedAt });
		})
		.andThen(({ packageRecord, receiptCreatedAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
				bookingSettings,
				packageRecord,
				receiptCreatedAt
			}))
		)
		.andThen(({ bookingSettings, packageRecord, receiptCreatedAt }) =>
			createPackageReceiptArtifacts(packageRecord, receiptCreatedAt, {
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		)
		.andThen((artifactsResult) =>
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data).map((pdfContent) =>
				toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf)
			)
		);
}
