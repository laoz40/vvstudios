"use node";

import { type ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { getPackageForAction } from "#convex/packages/services/lookup";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import {
	validateAdminBookingReceipt,
	validateAdminPackageReceipt,
	type InvoicePdfPayload
} from "#convex/stripe/lib/invoiceDownloads";
import {
	queryBookingByStripeSession,
	buildBookingReceiptArtifacts,
	buildBookingInvoiceArtifacts,
	buildPackageReceiptArtifacts,
	resolvePublicBookingInvoiceDownload,
	renderInvoicePdfPayloadFromArtifacts,
	validatePublicPackageReceiptDownload,
	renderReceiptPdfPayloadFromArtifacts
} from "#convex/stripe/lib/invoicePdfSteps";

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

export function loadBookingByStripeCheckoutSession(
	ctx: ActionCtx,
	stripeSessionId: string
): ResultAsync<Doc<"bookings"> | null, never> {
	return queryBookingByStripeSession(ctx, stripeSessionId);
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
	return loadBookingByStripeCheckoutSession(ctx, stripeSessionId).andThen(
		resolvePublicBookingInvoiceDownload
	);
}

export function loadBookingSettingsForPdf(
	ctx: ActionCtx
): ResultAsync<BookingSettingsSnapshot, never> {
	return queryBookingAvailabilitySettings(ctx);
}

export function renderBookingReceiptPdfPayload(
	booking: Doc<"bookings">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	const artifactsResult = buildBookingReceiptArtifacts(booking, receiptCreatedAt, bookingSettings);

	return artifactsResult.asyncAndThen(renderReceiptPdfPayloadFromArtifacts);
}

export function renderBookingInvoicePdfPayload(
	booking: Doc<"bookings">,
	invoiceCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingInvoicePdfError> {
	const artifactsResult = buildBookingInvoiceArtifacts(booking, invoiceCreatedAt, bookingSettings);

	return artifactsResult.asyncAndThen(renderInvoicePdfPayloadFromArtifacts);
}

export function loadPublicPackageReceiptDownload(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<
	{ packageRecord: Doc<"packages">; receiptCreatedAt: number },
	PublicPackageReceiptPdfError
> {
	return getPackageForAction(ctx, packageId).andThen(validatePublicPackageReceiptDownload);
}

export function renderPackageReceiptPdfPayload(
	packageRecord: Doc<"packages">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	const artifactsResult = buildPackageReceiptArtifacts(
		packageRecord,
		receiptCreatedAt,
		bookingSettings
	);

	return artifactsResult.asyncAndThen(renderReceiptPdfPayloadFromArtifacts);
}

export function loadAdminBookingForReceiptPdf(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<AdminBookingReceiptContext, AdminBookingReceiptPdfError> {
	return getSessionFromQuery(ctx, bookingId).andThen(validateAdminBookingReceipt);
}

export function loadAdminPackageForReceiptPdf(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<AdminPackageReceiptContext, AdminPackageReceiptPdfError> {
	return getPackageForAction(ctx, packageId).andThen(validateAdminPackageReceipt);
}
