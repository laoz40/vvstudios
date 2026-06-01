import type { Doc } from "#convex/_generated/dataModel";
import {
	bookingSchema,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

export type DownloadAdminBookingInvoiceInput = {
	booking: Doc<"bookings">;
	addons?: BookingFormValues["addons"];
	createdAt?: number;
	deliverableCount?: string;
	dueDate?: string;
	duration?: BookingFormValues["duration"];
	includeDepositLineItem?: boolean;
	invoiceNumber?: string;
	service?: BookingService;
};

export type DownloadAdminBookingInvoiceResult =
	| { success: true }
	| { message: string; success: false };

export async function downloadAdminBookingInvoice({
	booking,
	addons,
	createdAt,
	deliverableCount = booking.deliverableCount ?? "",
	dueDate,
	duration = booking.duration as BookingFormValues["duration"],
	includeDepositLineItem,
	invoiceNumber,
	service,
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
		date: booking.date,
		time: booking.time,
		duration,
		service: booking.service,
		addons: invoiceAddons,
		deliverableCount,
		notes: booking.notes ?? "",
	});

	if (!parsedBooking.success) {
		return {
			message: parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.",
			success: false,
		};
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
		deliverableCount: parsedBooking.data.deliverableCount || undefined,
		createdAt,
		includeDepositLineItem,
		invoiceNumber,
	});

	return { success: true };
}
