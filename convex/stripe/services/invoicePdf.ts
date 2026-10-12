"use node";

import { type ResultAsync, ok, safeTry } from "neverthrow";

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
	return safeTry(async function* () {
		const booking = yield* loadBookingByStripeCheckoutSession(ctx, stripeSessionId);
		const download = yield* resolvePublicBookingInvoiceDownload(booking);

		return ok(download);
	});
}

export function loadBookingSettingsForPdf(ctx: ActionCtx) {
	return queryBookingAvailabilitySettings(ctx);
}

export function renderBookingReceiptPdfPayload(
	booking: Doc<"bookings">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	const artifactsResult = buildBookingReceiptArtifacts(booking, receiptCreatedAt, bookingSettings);

	return safeTry(async function* () {
		const artifacts = yield* artifactsResult;
		const pdfPayload = yield* renderReceiptPdfPayloadFromArtifacts(artifacts);

		return ok(pdfPayload);
	});
}

export function renderBookingInvoicePdfPayload(
	booking: Doc<"bookings">,
	invoiceCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingInvoicePdfError> {
	const artifactsResult = buildBookingInvoiceArtifacts(booking, invoiceCreatedAt, bookingSettings);

	return safeTry(async function* () {
		const artifacts = yield* artifactsResult;
		const pdfPayload = yield* renderInvoicePdfPayloadFromArtifacts(artifacts);

		return ok(pdfPayload);
	});
}

export function loadPublicPackageReceiptDownload(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<
	{ packageRecord: Doc<"packages">; receiptCreatedAt: number },
	PublicPackageReceiptPdfError
> {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageForAction(ctx, packageId);
		const download = yield* validatePublicPackageReceiptDownload(packageRecord);

		return ok(download);
	});
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

	return safeTry(async function* () {
		const artifacts = yield* artifactsResult;
		const pdfPayload = yield* renderReceiptPdfPayloadFromArtifacts(artifacts);

		return ok(pdfPayload);
	});
}

export function loadAdminBookingForReceiptPdf(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<AdminBookingReceiptContext, AdminBookingReceiptPdfError> {
	return safeTry(async function* () {
		const session = yield* getSessionFromQuery(ctx, bookingId);
		const receiptContext = yield* validateAdminBookingReceipt(session);

		return ok(receiptContext);
	});
}

export function loadAdminPackageForReceiptPdf(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<AdminPackageReceiptContext, AdminPackageReceiptPdfError> {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageForAction(ctx, packageId);
		const receiptContext = yield* validateAdminPackageReceipt(packageRecord);

		return ok(receiptContext);
	});
}
