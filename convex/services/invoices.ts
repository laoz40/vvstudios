"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	createBookingInvoiceArtifactsForBooking,
	createBookingReceiptArtifactsForBooking,
	createCustomPackageInvoiceData,
	createPackageInvoiceArtifacts,
	createPackageReceiptArtifacts,
	renderBookingInvoicePdfInNode,
	renderBookingReceiptPdfInNode,
	type CustomPackageInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
import {
	toInvoicePdfPayload,
	validateBookingInvoiceDownload,
	validatePackageInvoiceDownload,
	validatePackageReceiptDownload,
	type InvoicePdfPayload
} from "#convex/lib/invoiceDownloads";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";

type BookingInvoicePdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "INVOICE_DOWNLOAD_FAILED" };

type BookingReceiptPdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "RECEIPT_DOWNLOAD_FAILED" };

type InvoicePdfError = BookingInvoicePdfError | { reason: "INVOICE_EMAIL_RENDER_FAILED" };

type PublicPackageInvoicePdfError =
	| InvoicePdfError
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
	| { reason: "PACKAGE_NOT_FOUND" };

type PublicPackageReceiptPdfError =
	| BookingReceiptPdfError
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" };

type AdminPackageInvoicePdfError =
	| InvoicePdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" };

function renderPackageInvoicePdf(
	packageRecord: Doc<"packages">,
	leadTimeMinutes: number
): ResultAsync<InvoicePdfPayload, InvoicePdfError> {
	return (
		createPackageInvoiceArtifacts(packageRecord, { leadTimeMinutes })
			// Render the validated package invoice into its downloadable PDF payload.
			.andThen((artifactsResult) =>
				renderBookingInvoicePdfInNode(artifactsResult.artifacts.data)
					.mapErr(() => ({ reason: "INVOICE_DOWNLOAD_FAILED" as const }))
					.map((pdfContent) => toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf))
			)
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
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data)
				.mapErr(() => ({ reason: "RECEIPT_DOWNLOAD_FAILED" as const }))
				.map((pdfContent) => toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf))
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

	return (
		okOrThrow(bookingPromise)
			.andThen((booking) =>
				booking
					? validateBookingInvoiceDownload(booking, Date.now())
					: err({ reason: "BOOKING_NOT_FOUND" as const })
			)
			// Load current lead-time guidance used by the invoice artifact.
			.andThen(({ booking, invoiceCreatedAt }) =>
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
					booking,
					bookingSettings,
					invoiceCreatedAt
				}))
			)
			// Validate and build the stored booking invoice data.
			.andThen(({ booking, bookingSettings, invoiceCreatedAt }) =>
				createBookingInvoiceArtifactsForBooking(booking, invoiceCreatedAt, {
					leadTimeMinutes: bookingSettings.leadTimeMinutes
				})
			)
			// Render the invoice into a downloadable PDF payload.
			.andThen((artifactsResult) =>
				renderBookingInvoicePdfInNode(artifactsResult.artifacts.data)
					.mapErr(() => ({ reason: "INVOICE_DOWNLOAD_FAILED" as const }))
					.map((pdfContent) => toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf))
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
			renderBookingReceiptPdfInNode(artifactsResult.artifacts.data)
				.mapErr(() => ({ reason: "RECEIPT_DOWNLOAD_FAILED" as const }))
				.map((pdfContent) => toInvoicePdfPayload(pdfContent, artifactsResult.artifacts.pdf))
		);
}

export function getPackageInvoicePdfByIdService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<InvoicePdfPayload, PublicPackageInvoicePdfError> {
	return (
		getPackageForAction(ctx, args.packageId)
			// Validate that the package's public download window remains open.
			.andThen((packageRecord) => validatePackageInvoiceDownload(packageRecord, Date.now()))
			// Load current lead-time guidance used by the package invoice artifact.
			.andThen((packageRecord) =>
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
					bookingSettings,
					packageRecord
				}))
			)
			// Render the package's stored commercial snapshot.
			.andThen(({ bookingSettings, packageRecord }) =>
				renderPackageInvoicePdf(packageRecord, bookingSettings.leadTimeMinutes)
			)
	);
}

export function getAdminPackageInvoicePdfByIdService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<InvoicePdfPayload, AdminPackageInvoicePdfError> {
	return (
		requirePermissionActions(ctx, "view:sensitive-booking-data")
			// Load the package only after admin authorization succeeds.
			.andThen(() => getPackageForAction(ctx, args.packageId))
			// Load current lead-time guidance used by the package invoice artifact.
			.andThen((packageRecord) =>
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
					bookingSettings,
					packageRecord
				}))
			)
			// Render the package invoice without the public expiry restriction.
			.andThen(({ bookingSettings, packageRecord }) =>
				renderPackageInvoicePdf(packageRecord, bookingSettings.leadTimeMinutes)
			)
	);
}

export function getAdminCustomPackageInvoicePdfByIdService(
	ctx: ActionCtx,
	args: { customInvoiceId: Id<"customInvoices"> }
): ResultAsync<InvoicePdfPayload, AdminPackageInvoicePdfError> {
	return (
		requirePermissionActions(ctx, "view:sensitive-booking-data")
			// Load the custom invoice and package input only after authorization succeeds.
			.andThen(() =>
				okOrThrow<CustomPackageInvoiceInput | null>(
					ctx.runQuery(internal.customInvoices.getPackageCustomInvoiceInput, args)
				)
			)
			.andThen((invoiceSource) =>
				invoiceSource ? ok(invoiceSource) : err({ reason: "PACKAGE_NOT_FOUND" as const })
			)
			// Load current lead-time guidance before building the custom artifact.
			.andThen((invoiceSource) =>
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((bookingSettings) => ({
					bookingSettings,
					invoiceSource
				}))
			)
			// Build the custom invoice data from its stored selections and amounts.
			.andThen(({ bookingSettings, invoiceSource }) =>
				createCustomPackageInvoiceData(invoiceSource, bookingSettings.leadTimeMinutes)
			)
			// Render the custom invoice into its downloadable PDF payload.
			.andThen((data) =>
				renderBookingInvoicePdfInNode(data)
					.mapErr(() => ({ reason: "INVOICE_DOWNLOAD_FAILED" as const }))
					.map((pdfContent) =>
						toInvoicePdfPayload(pdfContent, {
							contentType: "application/pdf",
							filename: `booking-invoice-${data.invoice.number.toLowerCase()}.pdf`
						})
					)
			)
	);
}
