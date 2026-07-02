import type { Doc } from "#convex/_generated/dataModel";
import { err, ok, type Result } from "#/lib/result";
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
	service?: BookingService;
};

export type DownloadAdminBookingInvoiceResult = Result<
	{ downloaded: true },
	{ message: string; reason: "INVALID_INVOICE_INPUT" }
>;

export async function downloadAdminBookingInvoice({
	booking,
	addons,
	createdAt,
	essentialEditQuantity = booking.essentialEditQuantity ?? "",
	clipsPackageQuantity = booking.clipsPackageQuantity ?? "",
	dueDate,
	duration = booking.duration as BookingFormValues["duration"],
	includeDepositLineItem,
	invoiceNumber,
	service
}: DownloadAdminBookingInvoiceInput): Promise<DownloadAdminBookingInvoiceResult> {
	const { downloadBookingInvoicePdf } =
		await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
	const invoiceAddons = addons ?? (booking.addons as BookingFormValues["addons"]);
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
		duration,
		service: booking.service,
		addons: invoiceAddons,
		essentialEditQuantity,
		clipsPackageQuantity,
		notes: booking.notes ?? ""
	});

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
		dueDate,
		time: parsedBooking.data.time,
		duration: parsedBooking.data.duration,
		service: service ?? parsedBooking.data.service,
		addons: parsedBooking.data.addons,
		essentialEditQuantity: parsedBooking.data.essentialEditQuantity || undefined,
		clipsPackageQuantity: parsedBooking.data.clipsPackageQuantity || undefined,
		createdAt,
		includeDepositLineItem,
		invoiceNumber
	});

	return ok({ downloaded: true });
}
