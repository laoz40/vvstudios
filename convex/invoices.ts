"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import {
	loadAdminBookingForReceiptPdf,
	loadAdminPackageForReceiptPdf,
	loadBookingSettingsForPdf,
	loadPublicBookingInvoiceDownload,
	loadPublicPackageReceiptDownload,
	renderBookingInvoicePdfPayload,
	renderBookingReceiptPdfPayload,
	renderPackageReceiptPdfPayload
} from "#convex/services/stripe/invoicePdfWorkflow";

export const getBookingReceiptPdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		loadPublicBookingInvoiceDownload(ctx, args.stripeSessionId)
			.andThen(({ booking, downloadCreatedAt }) =>
				loadBookingSettingsForPdf(ctx).map((bookingSettings) => ({
					booking,
					receiptCreatedAt: downloadCreatedAt,
					bookingSettings
				}))
			)
			.andThen(({ booking, receiptCreatedAt, bookingSettings }) =>
				renderBookingReceiptPdfPayload(booking, receiptCreatedAt, bookingSettings)
			)
			.match(tupleOk, tupleErr)
});

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		loadPublicBookingInvoiceDownload(ctx, args.stripeSessionId)
			.andThen(({ booking, downloadCreatedAt }) =>
				loadBookingSettingsForPdf(ctx).map((bookingSettings) => ({
					booking,
					invoiceCreatedAt: downloadCreatedAt,
					bookingSettings
				}))
			)
			.andThen(({ booking, invoiceCreatedAt, bookingSettings }) =>
				renderBookingInvoicePdfPayload(booking, invoiceCreatedAt, bookingSettings)
			)
			.match(tupleOk, tupleErr)
});

export const getPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		loadPublicPackageReceiptDownload(ctx, args.packageId)
			.andThen(({ packageRecord, receiptCreatedAt }) =>
				loadBookingSettingsForPdf(ctx).map((bookingSettings) => ({
					packageRecord,
					receiptCreatedAt,
					bookingSettings
				}))
			)
			.andThen(({ packageRecord, receiptCreatedAt, bookingSettings }) =>
				renderPackageReceiptPdfPayload(packageRecord, receiptCreatedAt, bookingSettings)
			)
			.match(tupleOk, tupleErr)
});

export const getAdminBookingReceiptPdfByBookingId = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		requirePermissionActions(ctx, "view:sensitive-booking-data")
			.andThen(() => loadAdminBookingForReceiptPdf(ctx, args.bookingId))
			.andThen(({ booking, receiptCreatedAt }) =>
				loadBookingSettingsForPdf(ctx).map((bookingSettings) => ({
					booking,
					receiptCreatedAt,
					bookingSettings
				}))
			)
			.andThen(({ booking, receiptCreatedAt, bookingSettings }) =>
				renderBookingReceiptPdfPayload(booking, receiptCreatedAt, bookingSettings)
			)
			.match(tupleOk, tupleErr)
});

export const getAdminPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		requirePermissionActions(ctx, "view:sensitive-booking-data")
			.andThen(() => loadAdminPackageForReceiptPdf(ctx, args.packageId))
			.andThen(({ packageRecord, receiptCreatedAt }) =>
				loadBookingSettingsForPdf(ctx).map((bookingSettings) => ({
					packageRecord,
					receiptCreatedAt,
					bookingSettings
				}))
			)
			.andThen(({ packageRecord, receiptCreatedAt, bookingSettings }) =>
				renderPackageReceiptPdfPayload(packageRecord, receiptCreatedAt, bookingSettings)
			)
			.match(tupleOk, tupleErr)
});
