"use node";

import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	loadAdminBookingForReceiptPdf,
	loadAdminPackageForReceiptPdf,
	loadBookingSettingsForPdf,
	loadPublicBookingInvoiceDownload,
	loadPublicPackageReceiptDownload,
	renderBookingInvoicePdfPayload,
	renderBookingReceiptPdfPayload,
	renderPackageReceiptPdfPayload
} from "#convex/stripe/services/invoicePdf";

export const getBookingReceiptPdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { booking, downloadCreatedAt } = yield* loadPublicBookingInvoiceDownload(
				ctx,
				args.stripeSessionId
			);

			const bookingSettings = yield* loadBookingSettingsForPdf(ctx);

			const receiptPdf = yield* renderBookingReceiptPdfPayload(
				booking,
				downloadCreatedAt,
				bookingSettings
			);

			return ok(receiptPdf);
		}).match(tupleOk, tupleErr)
});

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { booking, downloadCreatedAt } = yield* loadPublicBookingInvoiceDownload(
				ctx,
				args.stripeSessionId
			);

			const bookingSettings = yield* loadBookingSettingsForPdf(ctx);

			const invoicePdf = yield* renderBookingInvoicePdfPayload(
				booking,
				downloadCreatedAt,
				bookingSettings
			);

			return ok(invoicePdf);
		}).match(tupleOk, tupleErr)
});

export const getPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { packageRecord, receiptCreatedAt } = yield* loadPublicPackageReceiptDownload(
				ctx,
				args.packageId
			);

			const bookingSettings = yield* loadBookingSettingsForPdf(ctx);

			const receiptPdf = yield* renderPackageReceiptPdfPayload(
				packageRecord,
				receiptCreatedAt,
				bookingSettings
			);

			return ok(receiptPdf);
		}).match(tupleOk, tupleErr)
});

export const getAdminBookingReceiptPdfByBookingId = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "view:sensitive-booking-data");

			const { booking, receiptCreatedAt } = yield* loadAdminBookingForReceiptPdf(
				ctx,
				args.bookingId
			);

			const bookingSettings = yield* loadBookingSettingsForPdf(ctx);

			const receiptPdf = yield* renderBookingReceiptPdfPayload(
				booking,
				receiptCreatedAt,
				bookingSettings
			);

			return ok(receiptPdf);
		}).match(tupleOk, tupleErr)
});

export const getAdminPackageReceiptPdfById = action({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "view:sensitive-booking-data");

			const { packageRecord, receiptCreatedAt } = yield* loadAdminPackageForReceiptPdf(
				ctx,
				args.packageId
			);

			const bookingSettings = yield* loadBookingSettingsForPdf(ctx);

			const receiptPdf = yield* renderPackageReceiptPdfPayload(
				packageRecord,
				receiptCreatedAt,
				bookingSettings
			);

			return ok(receiptPdf);
		}).match(tupleOk, tupleErr)
});
