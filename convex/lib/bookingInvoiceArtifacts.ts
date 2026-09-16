import { err, errAsync, ok, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
	bookingSchema,
	packageFormSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildBookingInvoiceData,
	buildPackageInvoiceData,
	buildPackageAdjustmentInvoiceData,
	createStoredAmountPackageInvoiceLineItemSnapshot
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	buildBookingReceiptData,
	buildPackageAdjustmentReceiptData,
	buildPackageReceiptData
} from "#studio/features/booking-invoice/lib/build-booking-receipt-data";
import { renderBookingInvoiceEmail } from "#studio/features/booking-invoice/email/render-booking-invoice-email";
import { renderBookingReceiptEmail } from "#studio/features/booking-invoice/email/render-booking-receipt-email";
import type {
	BookingInvoiceData,
	BookingInvoiceLineItem,
	BookingReceiptData
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

function createReceiptPdfFilename(receiptNumber: string) {
	return `booking-receipt-${receiptNumber.toLowerCase()}.pdf`;
}

function createPackageReceiptPdfFilename(receiptNumber: string) {
	return `package-receipt-${receiptNumber.toLowerCase()}.pdf`;
}

function createPackageAdjustmentReceiptPdfFilename(receiptNumber: string) {
	return `package-adjustment-receipt-${receiptNumber.toLowerCase()}.pdf`;
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
	options: {
		customInvoice?: Doc<"customInvoices">;
		leadTimeMinutes: number;
		rescheduleUrl?: string;
	}
): ResultAsync<
	{
		artifacts: {
			data: BookingInvoiceData;
			emailHtml: string;
			pdf: { contentType: string; filename: string };
		};
		booking: BookingFormValues;
	},
	{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" }
> {
	const artifactsResult = createBookingInvoiceArtifactsForBooking(booking, createdAt, options);

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

	return artifactsResult.asyncAndThen((value) =>
		renderBookingInvoiceEmail(value.artifacts.data).map((emailHtml) => ({
			...value,
			artifacts: { ...value.artifacts, emailHtml }
		}))
	);
}

export function createBookingReceiptArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
) {
	const parsedBooking = bookingSchema.safeParse(getBookingInvoiceParseInput(booking, undefined));

	if (!parsedBooking.success) {
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	const data = buildBookingReceiptData({
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
		completeEditQuantity: parsedBooking.data.completeEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		handcraftedClipsQuantity: parsedBooking.data.handcraftedClipsQuantity || undefined,
		createdAt,
		leadTimeMinutes: options.leadTimeMinutes,
		rescheduleUrl: options.rescheduleUrl
	});

	return ok({
		artifacts: {
			data,
			pdf: {
				contentType: "application/pdf",
				filename: createReceiptPdfFilename(data.receipt.number)
			}
		},
		booking: parsedBooking.data
	});
}

export function createPackageReceiptEmailArtifacts(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { leadTimeMinutes: number }
) {
	return createPackageReceiptArtifacts(packageRecord, paidAt, options).asyncAndThen(
		(artifactsResult) =>
			renderBookingReceiptEmail(artifactsResult.artifacts.data).map((emailHtml) => ({
				...artifactsResult,
				artifacts: { ...artifactsResult.artifacts, emailHtml }
			}))
	);
}

export function createPackageAdjustmentReceiptArtifacts(
	invoiceInput: PackageAdjustmentInvoiceInput,
	paidAt: number,
	leadTimeMinutes: number
): Result<
	{ artifacts: { data: BookingReceiptData; pdf: { contentType: string; filename: string } } },
	{ reason: "INVALID_BOOKING_DATA" }
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
		return err({ reason: "INVALID_BOOKING_DATA" as const });
	}

	const data = buildPackageAdjustmentReceiptData({
		abn: packageRecord.abn,
		accountName: packageRecord.accountName,
		bookedAt: packageRecord.createdAt,
		duration: parsedPackage.data.duration,
		email: packageRecord.email,
		leadTimeMinutes,
		name: packageRecord.name,
		packageSize: packageRecord.packageSize,
		paidAt,
		phone: packageRecord.phone,
		quantity: adjustment.quantity,
		rate: adjustment.rate,
		receiptNumber: adjustment.invoiceNumber,
		totalAmount: adjustment.totalAmount
	});

	return ok({
		artifacts: {
			data,
			pdf: {
				contentType: "application/pdf",
				filename: createPackageAdjustmentReceiptPdfFilename(data.receipt.number)
			}
		}
	});
}

export function createPackageAdjustmentReceiptEmailArtifacts(
	invoiceInput: PackageAdjustmentInvoiceInput,
	paidAt: number,
	leadTimeMinutes: number
) {
	return createPackageAdjustmentReceiptArtifacts(
		invoiceInput,
		paidAt,
		leadTimeMinutes
	).asyncAndThen((artifactsResult) =>
		renderBookingReceiptEmail(artifactsResult.artifacts.data).map((emailHtml) => ({
			...artifactsResult,
			artifacts: { ...artifactsResult.artifacts, emailHtml }
		}))
	);
}

export function createBookingReceiptEmailArtifactsForBooking(
	booking: Doc<"bookings">,
	createdAt: number,
	options: { leadTimeMinutes: number; rescheduleUrl?: string }
): ResultAsync<
	{
		artifacts: {
			data: BookingReceiptData;
			emailHtml: string;
			pdf: { contentType: string; filename: string };
		};
		booking: BookingFormValues;
	},
	{ reason: "INVALID_BOOKING_DATA" | "RECEIPT_EMAIL_RENDER_FAILED" }
> {
	const artifactsResult = createBookingReceiptArtifactsForBooking(booking, createdAt, options);

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

	return artifactsResult.asyncAndThen((value) =>
		renderBookingReceiptEmail(value.artifacts.data).map((emailHtml) => ({
			...value,
			artifacts: { ...value.artifacts, emailHtml }
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

export function createPackageReceiptArtifacts(
	packageRecord: PackageInvoiceInput,
	paidAt: number,
	options: { leadTimeMinutes: number }
): Result<
	{ artifacts: { data: BookingReceiptData; pdf: { contentType: string; filename: string } } },
	{ reason: "INVALID_BOOKING_DATA" }
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
		return err({ reason: "INVALID_BOOKING_DATA" as const });
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

	const data = buildPackageReceiptData({
		packageId: packageRecord._id,
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
		paidAt,
		packageSize: packageRecord.packageSize,
		packageSubtotalAmount: packageRecord.packageSubtotalAmount,
		discountPercent: packageRecord.discountPercent,
		discountAmount: packageRecord.discountAmount,
		totalDueAmount: packageRecord.totalDueAmount,
		invoiceLineItems,
		leadTimeMinutes: options.leadTimeMinutes,
		receiptNumber: packageRecord.invoiceNumber
	});

	return ok({
		artifacts: {
			data,
			pdf: {
				contentType: "application/pdf",
				filename: createPackageReceiptPdfFilename(data.receipt.number)
			}
		}
	});
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
		invoiceDueAt: packageRecord.invoiceDueAt ?? packageRecord.createdAt,
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
