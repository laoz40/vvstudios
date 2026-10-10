import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { buildBookingSearchBlob } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/shared/lib/result";

type PackageSessionBookingInsert = Omit<Doc<"bookings">, "_id" | "_creationTime" | "searchBlob">;

export function insertPackageSessionBookingRow(
	ctx: MutationCtx,
	bookingFields: PackageSessionBookingInsert
) {
	return okOrThrow(
		ctx.db.insert("bookings", {
			...bookingFields,
			searchBlob: buildBookingSearchBlob(bookingFields)
		})
	);
}
