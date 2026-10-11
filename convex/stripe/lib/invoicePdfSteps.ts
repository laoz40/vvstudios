"use node";

import { err } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
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

import { fromConvexTuple } from "#convex/shared/lib/result";

import {
	toInvoicePdfPayload,
	validateBookingInvoiceDownload,
	validatePackageReceiptDownload
} from "#convex/stripe/lib/invoiceDownloads";

type BookingSettingsSnapshot = { leadTimeMinutes: number };

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

export function loadValidatedPublicBookingInvoice(booking: Doc<"bookings">) {
	return validateBookingInvoiceDownload(booking, Date.now()).map(
		({ booking: validatedBooking, invoiceCreatedAt }) => ({
			booking: validatedBooking,
			downloadCreatedAt: invoiceCreatedAt
		})
	);
}

export function resolvePublicBookingInvoiceDownload(booking: Doc<"bookings"> | null) {
	return booking
		? loadValidatedPublicBookingInvoice(booking)
		: err({ reason: "BOOKING_NOT_FOUND" as const });
}

export function renderReceiptPdfPayloadFromArtifacts(value: BookingReceiptArtifactsValue) {
	return renderBookingReceiptPdfInNode(value.artifacts.data).map(
		(pdfContent: Parameters<typeof toInvoicePdfPayload>[0]) =>
			toInvoicePdfPayload(pdfContent, value.artifacts.pdf)
	);
}

export function renderInvoicePdfPayloadFromArtifacts(value: BookingInvoiceArtifactsValue) {
	return renderBookingInvoicePdfInNode(value.artifacts.data).map(
		(pdfContent: Parameters<typeof toInvoicePdfPayload>[0]) =>
			toInvoicePdfPayload(pdfContent, value.artifacts.pdf)
	);
}

export function validatePublicPackageReceiptDownload(packageRecord: Doc<"packages">) {
	return validatePackageReceiptDownload(packageRecord, Date.now());
}

export function queryBookingByStripeSession(ctx: ActionCtx, stripeSessionId: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.checkout.getSessionByStripeSessionId, { stripeSessionId })
	);
}

export function buildBookingReceiptArtifacts(
	booking: Doc<"bookings">,
	receiptCreatedAt: number,
	settings: BookingSettingsSnapshot
) {
	return createBookingReceiptArtifactsForBooking(booking, receiptCreatedAt, {
		leadTimeMinutes: settings.leadTimeMinutes
	});
}

export function buildBookingInvoiceArtifacts(
	booking: Doc<"bookings">,
	invoiceCreatedAt: number,
	settings: BookingSettingsSnapshot
) {
	return createBookingInvoiceArtifactsForBooking(booking, invoiceCreatedAt, {
		leadTimeMinutes: settings.leadTimeMinutes
	});
}

export function buildPackageReceiptArtifacts(
	packageRecord: Doc<"packages">,
	receiptCreatedAt: number,
	settings: BookingSettingsSnapshot
) {
	return createPackageReceiptArtifacts(packageRecord, receiptCreatedAt, {
		leadTimeMinutes: settings.leadTimeMinutes
	});
}
