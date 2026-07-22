import type { Doc } from "#convex/_generated/dataModel";
import { err, ok, type Result } from "#/lib/result";
import {
	toAdminBookingAddons,
	toAdminBookingDuration
} from "#studio/features/admin/lib/admin-bookings";
import {
	bookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

export type DownloadAdminBookingInvoiceInput = {
	booking: Doc<"bookings">;
	addons?: BookingFormValues["addons"];
	createdAt?: number;
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	dueDate?: string;
	duration?: BookingFormValues["duration"];
	includeDepositLineItem?: boolean;
	invoiceNumber?: string;
	leadTimeMinutes: number;
	service?: BookingService | null;
	customTotalDueAmount?: number;
};

export type DownloadAdminBookingInvoiceResult = Result<
	{ downloaded: true },
	{ message: string; reason: "INVALID_INVOICE_INPUT" }
>;

function getInvoiceFormValues(input: DownloadAdminBookingInvoiceInput) {
	const { booking } = input;

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
		duration: input.duration ?? toAdminBookingDuration(booking.duration),
		service: booking.service,
		addons: input.addons ?? toAdminBookingAddons(booking.addons),
		essentialEditQuantity: input.essentialEditQuantity ?? booking.essentialEditQuantity ?? "",
		clipsPackageQuantity: input.clipsPackageQuantity ?? booking.clipsPackageQuantity ?? "",
		notes: booking.notes ?? ""
	};
}

function resolveInvoiceService(
	service: BookingService | null | undefined,
	parsedService: BookingFormValues["service"]
) {
	if (service === undefined) {
		return parsedService || undefined;
	}

	return service ?? undefined;
}

export async function downloadAdminBookingInvoice(
	input: DownloadAdminBookingInvoiceInput
): Promise<DownloadAdminBookingInvoiceResult> {
	const { booking } = input;
	const { downloadBookingInvoicePdf } =
		await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
	const parsedBooking = bookingSchema.safeParse(getInvoiceFormValues(input));

	if (!parsedBooking.success) {
		return err({
			message: parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.",
			reason: "INVALID_INVOICE_INPUT"
		});
	}

	await downloadBookingInvoicePdf({
		bookingId: booking._id,
		name: parsedBooking.data.name,
		phone: parsedBooking.data.phone,
		accountName: parsedBooking.data.accountName,
		abn: parsedBooking.data.abn,
		email: parsedBooking.data.email,
		date: parsedBooking.data.date,
		dueDate: input.dueDate,
		time: parsedBooking.data.time,
		duration: parsedBooking.data.duration,
		service: resolveInvoiceService(input.service, parsedBooking.data.service),
		addons: parsedBooking.data.addons,
		essentialEditQuantity: parsedBooking.data.essentialEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		createdAt: input.createdAt,
		leadTimeMinutes: input.leadTimeMinutes,
		includeDepositLineItem: input.includeDepositLineItem,
		invoiceNumber: input.invoiceNumber,
		customTotalDueAmount: input.customTotalDueAmount
	});

	return ok({ downloaded: true });
}
