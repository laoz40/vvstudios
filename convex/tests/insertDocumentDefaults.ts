import type { Doc } from "#convex/_generated/dataModel";
import { buildBookingSearchBlob, buildPackageSearchBlob } from "#convex/lib/adminSearchBlob";
import { contactNormalizedIndexFields } from "#convex/lib/contactNormalization";

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
	fields: Omit<BookingInsert, "searchBlob" | "phoneNormalized"> &
		Partial<Pick<BookingInsert, "searchBlob" | "phoneNormalized">>
): BookingInsert {
	const phoneNormalized =
		fields.phoneNormalized ?? contactNormalizedIndexFields(fields.phone).phoneNormalized;

	const searchBlob =
		fields.searchBlob ?? buildBookingSearchBlob(fields satisfies BookingSearchBlobSource);

	return { ...fields, phoneNormalized, searchBlob };
}

export function packageDocument(
	fields: Omit<PackageInsert, "searchBlob" | "phoneNormalized"> &
		Partial<Pick<PackageInsert, "searchBlob" | "phoneNormalized">>
): PackageInsert {
	const phoneNormalized =
		fields.phoneNormalized ?? contactNormalizedIndexFields(fields.phone).phoneNormalized;

	const searchBlob =
		fields.searchBlob ?? buildPackageSearchBlob(fields satisfies PackageSearchBlobSource);

	return { ...fields, phoneNormalized, searchBlob };
}
