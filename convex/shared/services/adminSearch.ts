import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const bookings = yield* loadPackageBookingsForReceiptSync(ctx, packageId);
		const updated = yield* updatePackageSessionBookingsContactSearch(ctx, bookings, contactFields);

		return ok(updated);
	});
}

function updatePackageSessionBookingsContactSearch(
	ctx: MutationCtx,
	bookings: Parameters<typeof buildPackageSessionBookingContactSearchPatch>[1][],
	contactFields: PackageContactSearchFields
) {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			bookings.map((booking) =>
				safeTry(async function* () {
					const patch = yield* buildPackageSessionBookingContactSearchPatch(
						ctx,
						booking,
						contactFields
					);

					const updated = yield* patchPackageSessionBookingContactSearch(ctx, booking._id, patch);

					return ok(updated);
				})
			)
		);

		return ok(null);
	});
}
