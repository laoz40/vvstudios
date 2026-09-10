import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { z } from "zod";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import {
	bookingSchema,
	DURATION_OPTIONS,
	packageFormSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildBookingInvoiceData,
	buildPackageInvoiceData,
	buildPackageAdjustmentInvoiceData,
	createPackageInvoiceLineItemSnapshot,
	createPriceAdjustmentInvoiceLineItem,
	createStoredAmountPackageInvoiceLineItemSnapshot
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { renderBookingInvoiceEmail } from "#studio/features/booking-invoice/email/render-booking-invoice-email";
import type {
	BookingInvoiceData,
	BookingInvoiceLineItem
} from "#studio/features/booking-invoice/lib/types";

export type MarkPackageInvoiceEmailAttemptArgs = {
	packageId: Id<"packages">;
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
	packageRecord: Doc<"packages">;
};

export type PackageInvoiceInput = Pick<
	Doc<"packages">,
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

export type CustomPackageInvoiceInput = {
	customInvoice: Doc<"customInvoices">;
	packageRecord: Doc<"packages">;
};

type CustomPackageFormData = z.infer<typeof packageFormSchema>;

function toCustomDuration(value: string | undefined): BookingFormValues["duration"] | "" {
	return DURATION_OPTIONS.find((duration) => duration === value) ?? "";
}

function resolveCustomInvoiceQuantity(
	customInvoice: Doc<"customInvoices">,
	packageRecord: Doc<"packages">,
	field:
		| "essentialEditQuantity"
		| "completeEditQuantity"
		| "clipsPackageQuantity"
		| "handcraftedClipsQuantity"
) {
	return customInvoice[field] ?? packageRecord[field] ?? "";
}

function parseCustomPackageInvoice(invoiceInput: CustomPackageInvoiceInput) {
	const { customInvoice, packageRecord } = invoiceInput;
	const packageSize = customInvoice.packageSize ?? packageRecord.packageSize;

	const parsedCustomInvoice = packageFormSchema.safeParse({
		name: packageRecord.name,
		phone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		email: packageRecord.email,
		duration: customInvoice.duration ?? packageRecord.duration,
		addons: customInvoice.addons,
		essentialEditQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"essentialEditQuantity"
		),
		completeEditQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"completeEditQuantity"
		),
		clipsPackageQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"clipsPackageQuantity"
		),
		handcraftedClipsQuantity: resolveCustomInvoiceQuantity(
			customInvoice,
			packageRecord,
			"handcraftedClipsQuantity"
		),
		notes: packageRecord.notes ?? "",
		packageSize
	});

	if (!parsedCustomInvoice.success) {
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	return ok({ customInvoiceData: parsedCustomInvoice.data, packageSize });
}

function createCustomInvoiceLineItems(
	customInvoiceData: CustomPackageFormData,
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

export function createCustomPackageInvoiceData(
	invoiceInput: CustomPackageInvoiceInput,
	leadTimeMinutes: number
) {
	return parseCustomPackageInvoice(invoiceInput).map(({ customInvoiceData, packageSize }) => {
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
			: invoiceInput.packageRecord.invoiceDueAt;

		return buildPackageInvoiceData({
			bookingId: invoiceInput.packageRecord._id,
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

function getCustomInvoiceQuantityDefault(
	booking: Doc<"bookings">,
	customInvoice: Doc<"customInvoices"> | undefined,
	field:
		| "essentialEditQuantity"
		| "completeEditQuantity"
		| "clipsPackageQuantity"
		| "handcraftedClipsQuantity"
) {
	if (customInvoice?.[field] !== undefined) {
		return customInvoice[field];
	}

	return booking[field] ?? "";
}

function getCustomInvoiceFieldDefaults(
	booking: Doc<"bookings">,
	customInvoice: Doc<"customInvoices"> | undefined
) {
	return {
		duration: customInvoice?.duration ?? booking.duration,
		// Custom invoices may intentionally omit studio hire and contain only add-ons.
		// Parse against the booking's valid service, then omit it from the artifact below.
		service: customInvoice?.service ?? booking.service,
		addons: customInvoice?.addons ?? booking.addons,
		essentialEditQuantity: getCustomInvoiceQuantityDefault(
			booking,
			customInvoice,
			"essentialEditQuantity"
		),
		completeEditQuantity: getCustomInvoiceQuantityDefault(
			booking,
			customInvoice,
			"completeEditQuantity"
		),
		clipsPackageQuantity: getCustomInvoiceQuantityDefault(
			booking,
			customInvoice,
			"clipsPackageQuantity"
		),
		handcraftedClipsQuantity: getCustomInvoiceQuantityDefault(
			booking,
			customInvoice,
			"handcraftedClipsQuantity"
		)
	};
}

function getBookingInvoiceParseInput(
	booking: Doc<"bookings">,
	customInvoice: Doc<"customInvoices"> | undefined
) {
	const {
		duration,
		service,
		addons,
		essentialEditQuantity,
		completeEditQuantity,
		clipsPackageQuantity,
		handcraftedClipsQuantity
	} = getCustomInvoiceFieldDefaults(booking, customInvoice);

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
	const { adjustment, packageRecord } = invoiceInput;

	const parsedPackage = packageFormSchema.safeParse({
		name: packageRecord.name,
		phone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		email: packageRecord.email,
		duration: packageRecord.duration,
		addons: packageRecord.addons,
		essentialEditQuantity: packageRecord.essentialEditQuantity ?? "",
		completeEditQuantity: packageRecord.completeEditQuantity ?? "",
		clipsPackageQuantity: packageRecord.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity ?? "",
		notes: packageRecord.notes ?? "",
		packageSize: packageRecord.packageSize
	});

	if (!parsedPackage.success) {
		return errAsync({ reason: "INVALID_BOOKING_DATA" as const });
	}

	const data = buildPackageAdjustmentInvoiceData({
		abn: packageRecord.abn,
		accountName: packageRecord.accountName,
		bookedAt: packageRecord.createdAt,
		createdAt: adjustment.createdAt,
		duration: parsedPackage.data.duration,
		email: packageRecord.email,
		invoiceDueAt: adjustment.invoiceDueAt,
		invoiceNumber: adjustment.invoiceNumber,
		name: packageRecord.name,
		packageSize: packageRecord.packageSize,
		phone: packageRecord.phone,
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

export function createPackageInvoiceArtifacts(
	packageRecord: PackageInvoiceInput,
	options: { leadTimeMinutes: number }
): ResultAsync<
	InvoiceEmailArtifacts,
	{ reason: "INVALID_BOOKING_DATA" } | { reason: "INVOICE_EMAIL_RENDER_FAILED" }
> {
	const parsedPackage = packageFormSchema.safeParse({
		name: packageRecord.name,
		phone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		email: packageRecord.email,
		duration: packageRecord.duration,
		addons: packageRecord.addons,
		essentialEditQuantity: packageRecord.essentialEditQuantity ?? "",
		completeEditQuantity: packageRecord.completeEditQuantity ?? "",
		clipsPackageQuantity: packageRecord.clipsPackageQuantity ?? "",
		handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity ?? "",
		notes: packageRecord.notes ?? "",
		packageSize: packageRecord.packageSize
	});

	if (!parsedPackage.success) {
		return errAsync({ reason: "INVALID_BOOKING_DATA" as const });
	}

	const packageFormData = parsedPackage.data;

	const invoiceLineItems =
		packageRecord.invoiceLineItems ??
		createStoredAmountPackageInvoiceLineItemSnapshot({
			discountAmount: packageRecord.discountAmount,
			discountPercent: packageRecord.discountPercent,
			duration: packageFormData.duration,
			packageSize: packageRecord.packageSize,
			packageSubtotalAmount: packageRecord.packageSubtotalAmount,
			singleSessionAmount: packageRecord.singleSessionAmount
		});

	const data = buildPackageInvoiceData({
		bookingId: packageRecord._id,
		name: packageFormData.name,
		phone: packageFormData.phone,
		accountName: packageFormData.accountName,
		abn: packageFormData.abn,
		email: packageFormData.email,
		duration: packageFormData.duration,
		addons: packageFormData.addons,
		essentialEditQuantity: packageFormData.essentialEditQuantity || undefined,
		completeEditQuantity: packageFormData.completeEditQuantity || undefined,
		clipsPackageQuantity: packageFormData.clipsPackageQuantity || undefined,
		handcraftedClipsQuantity: packageFormData.handcraftedClipsQuantity || undefined,
		createdAt: packageRecord.createdAt,
		invoiceDueAt: packageRecord.invoiceDueAt,
		invoiceNumber: packageRecord.invoiceNumber,
		packageSize: packageRecord.packageSize,
		packageSubtotalAmount: packageRecord.packageSubtotalAmount,
		discountPercent: packageRecord.discountPercent,
		discountAmount: packageRecord.discountAmount,
		totalDueAmount: packageRecord.totalDueAmount,
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
