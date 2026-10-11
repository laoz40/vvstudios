import { ResultAsync } from "neverthrow";
import type { MutationCtx } from "#convex/_generated/server";
import { loadPackageBookingsForReceiptSync } from "#convex/packages/lib/bookingsReceiptSync";
import {
	buildPackageSessionBookingContactSearchPatch,
	patchPackageSessionBookingContactSearch,
	type PackageContactSearchFields
} from "#convex/shared/lib/adminSearch/adminSearchBlob";

export function patchPackageSessionBookingsContactSearch(
	ctx: MutationCtx,
	packageId: Parameters<typeof loadPackageBookingsForReceiptSync>[1],
	contactFields: PackageContactSearchFields
) {
	return loadPackageBookingsForReceiptSync(ctx, packageId).andThen((bookings) =>
		updatePackageSessionBookingsContactSearch(ctx, bookings, contactFields)
	);
}

function updatePackageSessionBookingsContactSearch(
	ctx: MutationCtx,
	bookings: Parameters<typeof buildPackageSessionBookingContactSearchPatch>[1][],
	contactFields: PackageContactSearchFields
) {
	return ResultAsync.combine(
		bookings.map((booking) =>
			buildPackageSessionBookingContactSearchPatch(ctx, booking, contactFields).andThen((patch) =>
				patchPackageSessionBookingContactSearch(ctx, booking._id, patch)
			)
		)
	).map(() => null);
}
