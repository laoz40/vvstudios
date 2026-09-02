import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
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
export type PackageInvoiceEmailAttemptError =
	| { reason: "INVOICE_NUMBER_REQUIRED" }
	| { reason: "INVOICE_FAILURE_CODE_REQUIRED" };

export function validatePackageInvoiceEmailAttempt(
	args: MarkPackageInvoiceEmailAttemptArgs
): Result<null, PackageInvoiceEmailAttemptError> {
	if (args.status === "sent" && args.invoiceNumber === undefined) {
		return err({ reason: "INVOICE_NUMBER_REQUIRED" as const });
	}

	if (args.status === "failed" && args.failureCode === undefined) {
		return err({ reason: "INVOICE_FAILURE_CODE_REQUIRED" as const });
	}

	return ok(null);
}

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

type InvoiceEmailArtifacts = {
	artifacts: {
		data: BookingInvoiceData;
		emailHtml: string;
		pdf: { contentType: string; filename: string };
	};
};

export type PackageAdjustmentInvoiceInput = {
	adjustment: Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>;
	multiBooking: Doc<"multiBookingPackages">;
};

export type MultiBookingInvoiceInput = Pick<
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
	| "completeEditQuantity"
	| "clipsPackageQuantity"
	| "handcraftedClipsQuantity"
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

export type CustomMultiBookingInvoiceInput = {
	customInvoice: Doc<"customInvoices">;
	multiBooking: Doc<"multiBookingPackages">;
};

type CustomMultiBookingFormData = z.infer<typeof multiBookingFormSchema>;

function toCustomDuration(value: string | undefined): BookingFormValues["duration"] | "" {
	return DURATION_OPTIONS.find((duration) => duration === value) ?? "";
}

function parseCustomMultiBookingInvoice(invoiceInput: CustomMultiBookingInvoiceInput) {
	const packageSize =
		invoiceInput.customInvoice.packageSize ?? invoiceInput.multiBooking.packageSize;
	const parsedCustomInvoice = multiBookingFormSchema.safeParse({
		name: invoiceInput.multiBooking.name,
		phone: invoiceInput.multiBooking.phone,
		accountName: invoiceInput.multiBooking.accountName,
		abn: invoiceInput.multiBooking.abn,
		email: invoiceInput.multiBooking.email,
		duration: invoiceInput.customInvoice.duration ?? invoiceInput.multiBooking.duration,
		addons: invoiceInput.customInvoice.addons,
		essentialEditQuantity:
			invoiceInput.customInvoice.essentialEditQuantity ??
			invoiceInput.multiBooking.essentialEditQuantity ??
			"",
		completeEditQuantity:
			invoiceInput.customInvoice.completeEditQuantity ??
			invoiceInput.multiBooking.completeEditQuantity ??
			"",
		clipsPackageQuantity:
			invoiceInput.customInvoice.clipsPackageQuantity ??
			invoiceInput.multiBooking.clipsPackageQuantity ??
			"",
		handcraftedClipsQuantity:
			invoiceInput.customInvoice.handcraftedClipsQuantity ??
			invoiceInput.multiBooking.handcraftedClipsQuantity ??
			"",
		notes: invoiceInput.multiBooking.notes ?? "",
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
		completeEditQuantity: customInvoiceData.completeEditQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: customDuration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
		handcraftedClipsQuantity: customInvoiceData.handcraftedClipsQuantity || undefined,
		packageSize
	});
	const priceAdjustmentAmount = totalDueAmount - amounts.totalDueAmount;

	if (priceAdjustmentAmount !== 0) {
		invoiceLineItems.push(createPriceAdjustmentInvoiceLineItem(priceAdjustmentAmount));
	}

	return invoiceLineItems;
}

export function createCustomMultiBookingInvoiceData(
	invoiceInput: CustomMultiBookingInvoiceInput,
	leadTimeMinutes: number
) {
	return parseCustomMultiBookingInvoice(invoiceInput).map(({ customInvoiceData, packageSize }) => {
		// An omitted custom duration intentionally produces an add-ons-only invoice.
		const customDuration = toCustomDuration(invoiceInput.customInvoice.duration);
		const amounts = calculatePackageAmounts({
			...customInvoiceData,
			duration: customDuration,
			includeDiscount: invoiceInput.customInvoice.includePackageDiscount !== false,
			packageSize
		});
		const totalDueAmount =
			invoiceInput.customInvoice.customTotalDueAmount ?? amounts.totalDueAmount;
		const invoiceLineItems = createCustomInvoiceLineItems(
			customInvoiceData,
			customDuration,
			packageSize,
			amounts,
			totalDueAmount
		);
		const invoiceDueAt = invoiceInput.customInvoice.dueDate
			? new Date(`${invoiceInput.customInvoice.dueDate}T00:00:00`).getTime()
			: invoiceInput.multiBooking.invoiceDueAt;

		return buildMultiBookingInvoiceData({
			bookingId: invoiceInput.multiBooking._id,
			name: customInvoiceData.name,
			phone: customInvoiceData.phone,
			accountName: customInvoiceData.accountName,
			abn: customInvoiceData.abn,
			email: customInvoiceData.email,
			duration: customDuration || customInvoiceData.duration,
			addons: customInvoiceData.addons,
			essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
			completeEditQuantity: customInvoiceData.completeEditQuantity || undefined,
			clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
			handcraftedClipsQuantity: customInvoiceData.handcraftedClipsQuantity || undefined,
			createdAt: invoiceInput.customInvoice.createdAt,
			invoiceDueAt,
			invoiceNumber: invoiceInput.customInvoice.invoiceNumber,
			packageSize,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount,
			invoiceLineItems,
			leadTimeMinutes
		});
	});
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
		completeEditQuantity = booking.completeEditQuantity ?? "",
		clipsPackageQuantity = booking.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity = booking.handcraftedClipsQuantity ?? ""
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
		completeEditQuantity,
		clipsPackageQuantity,
		handcraftedClipsQuantity,
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
		return err({ reason: "INVALID_BOOKING_DATA" as const });
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
		completeEditQuantity: parsedBooking.data.completeEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		handcraftedClipsQuantity: parsedBooking.data.handcraftedClipsQuantity || undefined,
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

export function createBookingInvoiceEmailArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
) {
	return createBookingInvoiceArtifactsForBooking(booking, createdAt, options).asyncAndThen(
		(artifactsResult) =>
			renderBookingInvoiceEmail(artifactsResult.artifacts.data).map((emailHtml) => ({
				...artifactsResult,
				artifacts: { ...artifactsResult.artifacts, emailHtml }
			}))
	);
}

export function createPackageAdjustmentInvoiceArtifacts(
	invoiceInput: PackageAdjustmentInvoiceInput
): ResultAsync<
	InvoiceEmailArtifacts,
	{ reason: "INVALID_BOOKING_DATA" } | { reason: "INVOICE_EMAIL_RENDER_FAILED" }
> {
	const { adjustment, multiBooking } = invoiceInput;
	const parsedMultiBooking = multiBookingFormSchema.safeParse({
		name: multiBooking.name,
		phone: multiBooking.phone,
		accountName: multiBooking.accountName,
		abn: multiBooking.abn,
		email: multiBooking.email,
		duration: multiBooking.duration,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity ?? "",
		completeEditQuantity: multiBooking.completeEditQuantity ?? "",
		clipsPackageQuantity: multiBooking.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity: multiBooking.handcraftedClipsQuantity ?? "",
		notes: multiBooking.notes ?? "",
		packageSize: multiBooking.packageSize
	});

	if (!parsedMultiBooking.success) {
		return errAsync({ reason: "INVALID_BOOKING_DATA" as const });
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
	return renderBookingInvoiceEmail(data).map((emailHtml) => ({
		artifacts: {
			data,
			emailHtml,
			pdf: { contentType: "application/pdf", filename: createPdfFilename(data.invoice.number) }
		}
	}));
}

export function createMultiBookingInvoiceArtifacts(
	multiBooking: MultiBookingInvoiceInput,
	options: { leadTimeMinutes: number }
): ResultAsync<
	InvoiceEmailArtifacts,
	{ reason: "INVALID_BOOKING_DATA" } | { reason: "INVOICE_EMAIL_RENDER_FAILED" }
> {
	const parsedMultiBooking = multiBookingFormSchema.safeParse({
		name: multiBooking.name,
		phone: multiBooking.phone,
		accountName: multiBooking.accountName,
		abn: multiBooking.abn,
		email: multiBooking.email,
		duration: multiBooking.duration,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity ?? "",
		completeEditQuantity: multiBooking.completeEditQuantity ?? "",
		clipsPackageQuantity: multiBooking.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity: multiBooking.handcraftedClipsQuantity ?? "",
		notes: multiBooking.notes ?? "",
		packageSize: multiBooking.packageSize
	});

	if (!parsedMultiBooking.success) {
		return errAsync({ reason: "INVALID_BOOKING_DATA" as const });
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
		completeEditQuantity: multiBookingData.completeEditQuantity || undefined,
		clipsPackageQuantity: multiBookingData.clipsPackageQuantity || undefined,
		handcraftedClipsQuantity: multiBookingData.handcraftedClipsQuantity || undefined,
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
	return renderBookingInvoiceEmail(data).map((emailHtml) => ({
		artifacts: {
			data,
			emailHtml,
			pdf: { contentType: "application/pdf", filename: createPdfFilename(data.invoice.number) }
		}
	}));
}

export function renderBookingInvoicePdfInNode(data: BookingInvoiceData) {
	return ResultAsync.fromPromise(
		import("#studio/features/booking-invoice/pdf/render-booking-invoice-pdf").then(
			({ renderBookingInvoicePdf }) => renderBookingInvoicePdf(data)
		),
		() => ({ reason: "INVOICE_PDF_RENDER_FAILED" as const })
	);
}
