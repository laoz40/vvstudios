import { err, ok } from "../../src/lib/result";
import type { Doc } from "../_generated/dataModel";
import {
	bookingSchema,
	multiBookingFormSchema
} from "../../src/sites/studio/features/booking-form/lib/booking-form-model";
import {
	buildBookingInvoiceData,
	buildMultiBookingInvoiceData,
	createStoredAmountMultiBookingInvoiceLineItemSnapshot
} from "../../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { renderBookingInvoiceEmail } from "../../src/sites/studio/features/booking-invoice/email/render-booking-invoice-email";
import type {
	BookingInvoiceData,
	BookingInvoiceLineItem
} from "../../src/sites/studio/features/booking-invoice/lib/types";

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

export type MultiBookingInvoiceSource = Pick<
	Doc<"multiBookingPackages">,
	| "_id"
	| "name"
	| "phone"
	| "accountName"
	| "abn"
	| "email"
	| "duration"
	| "service"
	| "addons"
	| "essentialEditQuantity"
	| "clipsPackageQuantity"
	| "notes"
	| "packageSize"
	| "createdAt"
	| "invoiceDueAt"
	| "invoiceNumber"
	| "singleSessionAmount"
	| "packageSubtotalAmount"
	| "discountPercent"
	| "discountAmount"
	| "totalDueAmount"
> & { invoiceLineItems?: BookingInvoiceLineItem[] };

export function createBookingInvoiceArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
) {
	const parsedBooking = bookingSchema.safeParse({
		name: booking.name,
		phone: booking.phone,
		accountName: booking.accountName,
		abn: booking.abn,
		email: booking.email,
		bookingMode: "single",
		packageSize: "",
		date: booking.date,
		time: booking.time,
		duration: booking.duration,
		service: booking.service,
		addons: booking.addons,
		essentialEditQuantity: booking.essentialEditQuantity ?? "",
		clipsPackageQuantity: booking.clipsPackageQuantity ?? "",
		notes: booking.notes ?? ""
	});

	if (!parsedBooking.success) {
		return err({ reason: "INVALID_BOOKING_DATA" });
	}

	const data = buildBookingInvoiceData({
		bookingId: booking._id,
		name: parsedBooking.data.name,
		phone: parsedBooking.data.phone,
		accountName: parsedBooking.data.accountName,
		abn: parsedBooking.data.abn,
		email: parsedBooking.data.email,
		date: parsedBooking.data.date,
		time: parsedBooking.data.time,
		duration: parsedBooking.data.duration,
		service: parsedBooking.data.service || undefined,
		addons: parsedBooking.data.addons,
		essentialEditQuantity: parsedBooking.data.essentialEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		createdAt,
		leadTimeMinutes: options.leadTimeMinutes,
		rescheduleUrl: options.rescheduleUrl
	});

	return ok({
		artifacts: {
			data,
			pdf: { contentType: "application/pdf", filename: createPdfFilename(data.invoice.number) }
		},
		booking: parsedBooking.data
	});
}

export async function createBookingInvoiceEmailArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
) {
	const [artifactsError, artifactsResult] = createBookingInvoiceArtifactsForBooking(
		booking,
		createdAt,
		options
	);

	if (artifactsError !== null) {
		return err(artifactsError);
	}

	const [emailHtmlError, emailHtml] = await renderBookingInvoiceEmail(
		artifactsResult.artifacts.data
	);

	if (emailHtmlError !== null) {
		return err(emailHtmlError);
	}

	return ok({ ...artifactsResult, artifacts: { ...artifactsResult.artifacts, emailHtml } });
}

export async function createMultiBookingInvoiceArtifacts(
	multiBooking: MultiBookingInvoiceSource,
	options: { leadTimeMinutes: number }
) {
	const parsedMultiBooking = multiBookingFormSchema.safeParse({
		name: multiBooking.name,
		phone: multiBooking.phone,
		accountName: multiBooking.accountName,
		abn: multiBooking.abn,
		email: multiBooking.email,
		duration: multiBooking.duration,
		service: multiBooking.service,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity ?? "",
		clipsPackageQuantity: multiBooking.clipsPackageQuantity ?? "",
		notes: multiBooking.notes ?? "",
		packageSize: multiBooking.packageSize
	});

	if (!parsedMultiBooking.success) {
		return err({ reason: "INVALID_BOOKING_DATA" });
	}

	const multiBookingData = parsedMultiBooking.data;

	const invoiceLineItems =
		multiBooking.invoiceLineItems ??
		createStoredAmountMultiBookingInvoiceLineItemSnapshot({
			discountAmount: multiBooking.discountAmount,
			discountPercent: multiBooking.discountPercent,
			duration: multiBookingData.duration,
			packageSize: multiBooking.packageSize,
			packageSubtotalAmount: multiBooking.packageSubtotalAmount,
			service: multiBookingData.service || undefined,
			singleSessionAmount: multiBooking.singleSessionAmount
		});
	const data = buildMultiBookingInvoiceData({
		bookingId: multiBooking._id,
		name: multiBookingData.name,
		phone: multiBookingData.phone,
		accountName: multiBookingData.accountName,
		abn: multiBookingData.abn,
		email: multiBookingData.email,
		duration: multiBookingData.duration,
		service: multiBookingData.service || undefined,
		addons: multiBookingData.addons,
		essentialEditQuantity: multiBookingData.essentialEditQuantity || undefined,
		clipsPackageQuantity: multiBookingData.clipsPackageQuantity || undefined,
		createdAt: multiBooking.createdAt,
		invoiceDueAt: multiBooking.invoiceDueAt,
		invoiceNumber: multiBooking.invoiceNumber,
		packageSize: multiBooking.packageSize,
		packageSubtotalAmount: multiBooking.packageSubtotalAmount,
		discountPercent: multiBooking.discountPercent,
		discountAmount: multiBooking.discountAmount,
		totalDueAmount: multiBooking.totalDueAmount,
		invoiceLineItems,
		leadTimeMinutes: options.leadTimeMinutes
	});
	const [emailHtmlError, emailHtml] = await renderBookingInvoiceEmail(data);

	if (emailHtmlError !== null) {
		return err(emailHtmlError);
	}

	return ok({
		artifacts: {
			data,
			emailHtml,
			pdf: { contentType: "application/pdf", filename: createPdfFilename(data.invoice.number) }
		}
	});
}

export async function renderBookingInvoicePdfInNode(data: BookingInvoiceData) {
	try {
		const { renderBookingInvoicePdf } =
			await import("../../src/sites/studio/features/booking-invoice/pdf/render-booking-invoice-pdf");

		return ok(await renderBookingInvoicePdf(data));
	} catch {
		return err({ reason: "INVOICE_PDF_RENDER_FAILED" });
	}
}
