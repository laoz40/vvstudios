import type { Doc } from "#convex/_generated/dataModel";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import {
	toAdminSessionAddons,
	toAdminSessionDuration
} from "#studio/features/admin/lib/admin-sessions";
import {
	bookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

export type DownloadAdminBookingInvoiceInput = {
	session: Doc<"bookings">;
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
	const { session } = input;

	return {
		name: session.name,
		phone: session.phone,
		accountName: session.accountName,
		abn: session.abn,
		email: session.email,
		bookingMode: "single",
		packageSize: "",
		date: session.date,
		time: session.time,
		duration: input.duration ?? toAdminSessionDuration(session.duration),
		service: session.service,
		addons: input.addons ?? toAdminSessionAddons(session.addons),
		essentialEditQuantity: input.essentialEditQuantity ?? session.essentialEditQuantity ?? "",
		clipsPackageQuantity: input.clipsPackageQuantity ?? session.clipsPackageQuantity ?? "",
		notes: session.notes ?? ""
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
	const { session } = input;
	const { downloadBookingInvoicePdf } =
		await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
	const parsedBooking = bookingSchema.safeParse(getInvoiceFormValues(input));

	if (!parsedBooking.success) {
		return tupleErr({
			message: parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.",
			reason: "INVALID_INVOICE_INPUT"
		});
	}

	await downloadBookingInvoicePdf({
		bookingId: session._id,
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

	return tupleOk({ downloaded: true });
}
