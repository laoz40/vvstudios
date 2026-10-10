"use node";

import { err, errAsync, type ResultAsync } from "neverthrow";
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
} from "#convex/booking/lib/invoicePdfRender";
import { getPackageForAction } from "#convex/packages/services/lookup";
import { okOrThrow } from "#convex/shared/lib/result";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import {
	toInvoicePdfPayload,
	validateAdminBookingReceipt,
	validateAdminPackageReceipt,
	validateBookingInvoiceDownload,
	validatePackageReceiptDownload,
	type InvoicePdfPayload
} from "#convex/stripe/lib/invoiceDownloads";

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

function toPublicBookingDownload({
	booking: validatedBooking,
	invoiceCreatedAt
}: {
	booking: Doc<"bookings">;
	invoiceCreatedAt: number;
}) {
	return { booking: validatedBooking, downloadCreatedAt: invoiceCreatedAt };
}

function loadValidatedPublicBookingInvoice(booking: Doc<"bookings">) {
	return validateBookingInvoiceDownload(booking, Date.now()).map(toPublicBookingDownload);
}

function resolvePublicBookingInvoiceDownload(booking: Doc<"bookings"> | null) {
	return booking
		? loadValidatedPublicBookingInvoice(booking)
		: err({ reason: "BOOKING_NOT_FOUND" as const });
}

type BookingReceiptArtifactsValue = {
	artifacts: {
		data: Parameters<typeof renderBookingReceiptPdfInNode>[0];
		pdf: { contentType: string; filename: string };
	};
};

type BookingInvoiceArtifactsValue = {
	artifacts: {
		data: Parameters<typeof renderBookingInvoicePdfInNode>[0];
		pdf: { contentType: string; filename: string };
	};
};

function renderReceiptPdfPayloadFromArtifacts(value: BookingReceiptArtifactsValue) {
	return renderBookingReceiptPdfInNode(value.artifacts.data).map(
		(pdfContent: Parameters<typeof toInvoicePdfPayload>[0]) =>
			toInvoicePdfPayloadFromArtifacts(value, pdfContent)
	);
}

function toInvoicePdfPayloadFromArtifacts(
	value: { artifacts: { pdf: Parameters<typeof toInvoicePdfPayload>[1] } },
	pdfContent: Parameters<typeof toInvoicePdfPayload>[0]
) {
	return toInvoicePdfPayload(pdfContent, value.artifacts.pdf);
}

function renderInvoicePdfPayloadFromArtifacts(value: BookingInvoiceArtifactsValue) {
	return renderBookingInvoicePdfInNode(value.artifacts.data).map(
		(pdfContent: Parameters<typeof toInvoicePdfPayload>[0]) =>
			toInvoicePdfPayloadFromArtifacts(value, pdfContent)
	);
}

function validatePublicPackageReceiptDownload(packageRecord: Doc<"packages">) {
	return validatePackageReceiptDownload(packageRecord, Date.now());
}

export function loadBookingByStripeCheckoutSession(
	ctx: ActionCtx,
	stripeSessionId: string
): ResultAsync<Doc<"bookings"> | null, never> {
	return okOrThrow(
		ctx.runQuery(internal.sessions.checkout.getSessionByStripeSessionId, { stripeSessionId })
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
	return loadBookingByStripeCheckoutSession(ctx, stripeSessionId).andThen(
		resolvePublicBookingInvoiceDownload
	);
}

export function loadBookingSettingsForPdf(
	ctx: ActionCtx
): ResultAsync<BookingSettingsSnapshot, never> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}

export function renderBookingReceiptPdfPayload(
	booking: Doc<"bookings">,
	receiptCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingReceiptPdfError> {
	const artifactsResult = createBookingReceiptArtifactsForBooking(booking, receiptCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	});

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

	return artifactsResult.asyncAndThen(renderReceiptPdfPayloadFromArtifacts);
}

export function renderBookingInvoicePdfPayload(
	booking: Doc<"bookings">,
	invoiceCreatedAt: number,
	bookingSettings: BookingSettingsSnapshot
): ResultAsync<InvoicePdfPayload, BookingInvoicePdfError> {
	const artifactsResult = createBookingInvoiceArtifactsForBooking(booking, invoiceCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	});

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

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
	const artifactsResult = createPackageReceiptArtifacts(packageRecord, receiptCreatedAt, {
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	});

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

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
