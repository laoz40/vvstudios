import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { patchPackageSessionBookingsContactSearchStep } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { validateActivePackageForInstagramUpdate } from "#convex/packages/lib/checkout";
import { patchPackageRowInstagramHandle } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

type PackageContactSearchFields = {
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	instagramHandle: string;
};

export function loadPackageEligibleForInstagramUpdate(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId).andThen(validateActivePackageForInstagramUpdate);
}

function syncInstagramContactSearch(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	contactFields: PackageContactSearchFields
) {
	return patchPackageSessionBookingsContactSearchStep(ctx, packageId, contactFields);
}

export function savePackageInstagramHandle(
	ctx: MutationCtx,
	args: { packageFromDb: Doc<"packages">; instagramHandle: string }
) {
	const contactFields: PackageContactSearchFields = {
		name: args.packageFromDb.name,
		phone: args.packageFromDb.phone,
		accountName: args.packageFromDb.accountName,
		abn: args.packageFromDb.abn,
		email: args.packageFromDb.email,
		instagramHandle: args.instagramHandle
	};

	return patchPackageRowInstagramHandle(ctx, args).andThen(() =>
		syncInstagramContactSearch(ctx, args.packageFromDb._id, contactFields)
	);
}
