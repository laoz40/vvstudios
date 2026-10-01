import type { Doc } from "#convex/_generated/dataModel";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

/** Paid receipt / invoice numbers: `VV-20250327-ABCD` (paid date + last 4 id chars). */
export function formatBookingReceiptNumber(documentId: string, paidAt: number) {
	return formatBookingInvoiceNumber(documentId, paidAt);
}

type BookingReceiptDisplaySource = Pick<
	Doc<"bookings">,
	"_id" | "receiptNumber" | "packageId" | "paymentCompletedAt" | "bookingConfirmedAt" | "status"
>;

export function resolveBookingReceiptNumberForDisplay(
	booking: BookingReceiptDisplaySource
): string | undefined {
	if (booking.receiptNumber !== undefined && booking.receiptNumber.length > 0) {
		return booking.receiptNumber;
	}

	if (booking.packageId !== undefined) {
		return undefined;
	}

	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return undefined;
	}

	const paidAt = booking.paymentCompletedAt ?? booking.bookingConfirmedAt;

	if (paidAt === undefined) {
		return undefined;
	}

	return formatBookingReceiptNumber(booking._id, paidAt);
}

type PackageReceiptSource = Pick<Doc<"packages">, "_id" | "receiptNumber">;

export function resolvePackageReceiptNumber(
	packageRecord: PackageReceiptSource,
	paidAt: number
): string {
	if (packageRecord.receiptNumber !== undefined && packageRecord.receiptNumber.length > 0) {
		return packageRecord.receiptNumber;
	}

	return formatBookingReceiptNumber(packageRecord._id, paidAt);
}

export function bookingReceiptPaidAt(booking: Doc<"bookings">, fallbackPaidAt: number) {
	return booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? fallbackPaidAt;
}

export function resolveBookingReceiptNumber(booking: Doc<"bookings">, paidAt: number) {
	if (booking.receiptNumber !== undefined && booking.receiptNumber.length > 0) {
		return booking.receiptNumber;
	}

	return formatBookingReceiptNumber(booking._id, paidAt);
}
