import { ok, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { patchPackageSessionBookingsContactSearch } from "#convex/shared/services/adminSearch";
import { validateActivePackageForInstagramUpdate } from "#convex/packages/lib/checkout";
import { patchPackageRowInstagramHandle } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

export function loadPackageEligibleForInstagramUpdate(ctx: MutationCtx, packageId: Id<"packages">) {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, packageId);
		const activePackage = yield* validateActivePackageForInstagramUpdate(packageRecord);

		return ok(activePackage);
	});
}

export function savePackageInstagramHandle(
	ctx: MutationCtx,
	args: { packageFromDb: Doc<"packages">; instagramHandle: string }
) {
	const contactFields = {
		name: args.packageFromDb.name,
		phone: args.packageFromDb.phone,
		accountName: args.packageFromDb.accountName,
		abn: args.packageFromDb.abn,
		email: args.packageFromDb.email,
		instagramHandle: args.instagramHandle
	};

	return safeTry(async function* () {
		yield* patchPackageRowInstagramHandle(ctx, args);

		const updatedBookings = yield* patchPackageSessionBookingsContactSearch(
			ctx,
			args.packageFromDb._id,
			contactFields
		);

		return ok(updatedBookings);
	});
}
