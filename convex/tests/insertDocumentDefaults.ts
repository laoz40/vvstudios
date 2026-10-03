import type { Doc } from "#convex/_generated/dataModel";
import { buildBookingSearchBlob, buildPackageSearchBlob } from "#convex/lib/adminSearch/adminSearchBlob";
import { normalizePhone } from "#convex/lib/contactNormalization";

type BookingInsert = Omit<Doc<"bookings">, "_id" | "_creationTime">;

type PackageInsert = Omit<Doc<"packages">, "_id" | "_creationTime">;

type BookingSearchBlobSource = Pick<
	BookingInsert,
	"name" | "phone" | "accountName" | "abn" | "email" | "instagramHandle" | "receiptNumber" | "notes"
>;

type PackageSearchBlobSource = Pick<
	PackageInsert,
	"name" | "phone" | "accountName" | "abn" | "email" | "instagramHandle" | "receiptNumber" | "notes"
>;

export function bookingDocument(
	fields: Omit<BookingInsert, "searchBlob" | "phone"> &
		Partial<Pick<BookingInsert, "searchBlob">> & { phone: string }
): BookingInsert {
	const phone = normalizePhone(fields.phone);
	const merged = { ...fields, phone };

	const searchBlob =
		merged.searchBlob ?? buildBookingSearchBlob(merged satisfies BookingSearchBlobSource);

	return { ...merged, searchBlob };
}

export function packageDocument(
	fields: Omit<PackageInsert, "searchBlob" | "phone"> &
		Partial<Pick<PackageInsert, "searchBlob">> & { phone: string }
): PackageInsert {
	const phone = normalizePhone(fields.phone);
	const merged = { ...fields, phone };

	const searchBlob =
		merged.searchBlob ?? buildPackageSearchBlob(merged satisfies PackageSearchBlobSource);

	return { ...merged, searchBlob };
}
