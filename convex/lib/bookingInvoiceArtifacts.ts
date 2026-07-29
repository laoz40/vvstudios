import { err as neverthrowErr, ok as neverthrowOk } from "neverthrow";
import { err, ok } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { z } from "zod";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import {
	bookingSchema,
	DURATION_OPTIONS,
	multiBookingFormSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildBookingInvoiceData,
	buildMultiBookingInvoiceData,
	buildPackageAdjustmentInvoiceData,
	createPackageInvoiceLineItemSnapshot,
	createPriceAdjustmentInvoiceLineItem,
	createStoredAmountMultiBookingInvoiceLineItemSnapshot
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { renderBookingInvoiceEmail } from "#studio/features/booking-invoice/email/render-booking-invoice-email";
import type {
	BookingInvoiceData,
	BookingInvoiceLineItem
} from "#studio/features/booking-invoice/lib/types";

export type MarkPackageInvoiceEmailAttemptArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	status: "sent" | "failed";
	invoiceNumber?: string;
	failureCode?: string;
};

export function validatePackageInvoiceEmailAttempt(args: MarkPackageInvoiceEmailAttemptArgs) {
	if (args.status === "sent" && args.invoiceNumber === undefined) {
		return neverthrowErr({ reason: "INVOICE_NUMBER_REQUIRED" as const });
	}

	if (args.status === "failed" && args.failureCode === undefined) {
		return neverthrowErr({ reason: "INVOICE_FAILURE_CODE_REQUIRED" as const });
	}

	return neverthrowOk(null);
}

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

export type PackageAdjustmentInvoiceSource = {
	adjustment: Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>;
	multiBooking: Doc<"multiBookingPackages">;
};

export type MultiBookingInvoiceSource = Pick<
	Doc<"multiBookingPackages">,
	| "_id"
	| "name"
	| "phone"
	| "accountName"
	| "abn"
	| "email"
	| "duration"
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

type CustomMultiBookingInvoiceSource = {
	customInvoice: Doc<"customInvoices">;
	multiBooking: Doc<"multiBookingPackages">;
};

type CustomMultiBookingFormData = z.infer<typeof multiBookingFormSchema>;

function toCustomDuration(value: string | undefined): BookingFormValues["duration"] | "" {
	return DURATION_OPTIONS.find((duration) => duration === value) ?? "";
}

function parseCustomMultiBookingInvoice(source: CustomMultiBookingInvoiceSource) {
	const packageSize = source.customInvoice.packageSize ?? source.multiBooking.packageSize;
	const parsedCustomInvoice = multiBookingFormSchema.safeParse({
		name: source.multiBooking.name,
		phone: source.multiBooking.phone,
		accountName: source.multiBooking.accountName,
		abn: source.multiBooking.abn,
		email: source.multiBooking.email,
		duration: source.customInvoice.duration ?? source.multiBooking.duration,
		addons: source.customInvoice.addons,
		essentialEditQuantity:
			source.customInvoice.essentialEditQuantity ?? source.multiBooking.essentialEditQuantity ?? "",
		clipsPackageQuantity:
			source.customInvoice.clipsPackageQuantity ?? source.multiBooking.clipsPackageQuantity ?? "",
		notes: source.multiBooking.notes ?? "",
		packageSize
	});

	if (!parsedCustomInvoice.success) {
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	return ok({ customInvoiceData: parsedCustomInvoice.data, packageSize });
}

function createCustomInvoiceLineItems(
	customInvoiceData: CustomMultiBookingFormData,
	customDuration: BookingFormValues["duration"] | "",
	packageSize: number,
	amounts: ReturnType<typeof calculatePackageAmounts>,
	totalDueAmount: number
) {
	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		addons: customInvoiceData.addons,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: customDuration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
		packageSize
	});
	const priceAdjustmentAmount = totalDueAmount - amounts.totalDueAmount;

	if (priceAdjustmentAmount !== 0) {
		invoiceLineItems.push(createPriceAdjustmentInvoiceLineItem(priceAdjustmentAmount));
	}

	return invoiceLineItems;
}

export function createCustomMultiBookingInvoiceData(
	source: CustomMultiBookingInvoiceSource,
	leadTimeMinutes: number
) {
	const [parseError, parsed] = parseCustomMultiBookingInvoice(source);

	if (parseError !== null) {
		return err(parseError);
	}

	const { customInvoiceData, packageSize } = parsed;
	// An omitted custom duration intentionally produces an add-ons-only invoice.
	const customDuration = toCustomDuration(source.customInvoice.duration);
	const amounts = calculatePackageAmounts({
		addons: customInvoiceData.addons,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity,
		duration: customDuration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity,
		includeDiscount: source.customInvoice.includePackageDiscount !== false,
		packageSize
	});
	const totalDueAmount = source.customInvoice.customTotalDueAmount ?? amounts.totalDueAmount;
	const invoiceLineItems = createCustomInvoiceLineItems(
		customInvoiceData,
		customDuration,
		packageSize,
		amounts,
		totalDueAmount
	);
	const invoiceDueAt = source.customInvoice.dueDate
		? new Date(`${source.customInvoice.dueDate}T00:00:00`).getTime()
		: source.multiBooking.invoiceDueAt;

	return ok(
		buildMultiBookingInvoiceData({
			bookingId: source.multiBooking._id,
			name: customInvoiceData.name,
			phone: customInvoiceData.phone,
			accountName: customInvoiceData.accountName,
			abn: customInvoiceData.abn,
			email: customInvoiceData.email,
			duration: customDuration || customInvoiceData.duration,
			addons: customInvoiceData.addons,
			essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
			clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
			createdAt: source.customInvoice.createdAt,
			invoiceDueAt,
			invoiceNumber: source.customInvoice.invoiceNumber,
			packageSize,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount,
			invoiceLineItems,
			leadTimeMinutes
		})
	);
}

function getBookingInvoiceParseInput(
	booking: Doc<"bookings">,
	customInvoice: Doc<"customInvoices"> | undefined
) {
	const {
		duration = booking.duration,
		// Custom invoices may intentionally omit studio hire and contain only add-ons.
		// Parse against the booking's valid service, then omit it from the artifact below.
		service = booking.service,
		addons = booking.addons,
		essentialEditQuantity = booking.essentialEditQuantity ?? "",
		clipsPackageQuantity = booking.clipsPackageQuantity ?? ""
	} = customInvoice ?? {};

	return {
		name: booking.name,
		phone: booking.phone,
		accountName: booking.accountName,
		abn: booking.abn,
		email: booking.email,
		bookingMode: "single",
		packageSize: "",
		date: booking.date,
		time: booking.time,
		duration,
		service,
		addons,
		essentialEditQuantity,
		clipsPackageQuantity,
		notes: booking.notes ?? ""
	};
}

function getBookingInvoiceService(
	customInvoice: Doc<"customInvoices"> | undefined,
	service: BookingFormValues["service"]
) {
	if (customInvoice && !customInvoice.service) {
		return undefined;
	}

	return service || undefined;
}

export function createBookingInvoiceArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: {
		customInvoice?: Doc<"customInvoices">;
		leadTimeMinutes: number;
		rescheduleUrl?: string;
	}
) {
	const customInvoice = options.customInvoice;
	const parsedBooking = bookingSchema.safeParse(
		getBookingInvoiceParseInput(booking, customInvoice)
	);

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
		service: getBookingInvoiceService(customInvoice, parsedBooking.data.service),
		addons: parsedBooking.data.addons,
		essentialEditQuantity: parsedBooking.data.essentialEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		createdAt: customInvoice?.createdAt ?? createdAt,
		dueDate: customInvoice?.dueDate,
		includeDepositLineItem: customInvoice?.includeDepositLineItem,
		invoiceNumber: customInvoice?.invoiceNumber,
		customTotalDueAmount: customInvoice?.customTotalDueAmount,
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

export async function createPackageAdjustmentInvoiceArtifacts(
	source: PackageAdjustmentInvoiceSource
) {
	const { adjustment, multiBooking } = source;
	const parsedMultiBooking = multiBookingFormSchema.safeParse({
		name: multiBooking.name,
		phone: multiBooking.phone,
		accountName: multiBooking.accountName,
		abn: multiBooking.abn,
		email: multiBooking.email,
		duration: multiBooking.duration,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity ?? "",
		clipsPackageQuantity: multiBooking.clipsPackageQuantity ?? "",
		notes: multiBooking.notes ?? "",
		packageSize: multiBooking.packageSize
	});

	if (!parsedMultiBooking.success) {
		return err({ reason: "INVALID_BOOKING_DATA" });
	}

	const data = buildPackageAdjustmentInvoiceData({
		abn: multiBooking.abn,
		accountName: multiBooking.accountName,
		bookedAt: multiBooking.createdAt,
		createdAt: adjustment.createdAt,
		duration: parsedMultiBooking.data.duration,
		email: multiBooking.email,
		invoiceDueAt: adjustment.invoiceDueAt,
		invoiceNumber: adjustment.invoiceNumber,
		name: multiBooking.name,
		packageSize: multiBooking.packageSize,
		phone: multiBooking.phone,
		quantity: adjustment.quantity,
		rate: adjustment.rate,
		totalAmount: adjustment.totalAmount
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
			await import("#studio/features/booking-invoice/pdf/render-booking-invoice-pdf");

		return ok(await renderBookingInvoicePdf(data));
	} catch {
		return err({ reason: "INVOICE_PDF_RENDER_FAILED" });
	}
}
