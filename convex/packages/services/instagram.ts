import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { patchPackageSessionBookingsContactSearch } from "#convex/shared/services/adminSearch";
import { validateActivePackageForInstagramUpdate } from "#convex/packages/lib/checkout";
import { patchPackageRowInstagramHandle } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

export function loadPackageEligibleForInstagramUpdate(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId).andThen(validateActivePackageForInstagramUpdate);
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

	return patchPackageRowInstagramHandle(ctx, args).andThen(() =>
		patchPackageSessionBookingsContactSearch(ctx, args.packageFromDb._id, contactFields)
	);
}
