import type { Doc } from "#convex/_generated/dataModel";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { setPackageArchived } from "#convex/lib/archiveState";
import { requirePermission } from "#convex/services/auth";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import {
	buildPackageUpdatePatch,
	parsePackageUpdate,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "#convex/lib/packages/packageUpdates";
import {
	patchPackageSessionBookingsContactSearch,
	searchBlobPatchForPackage,
	type PackageContactSearchFields
} from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";

type ArchivePackageArgs = { packageId: Id<"packages">; archived: boolean };

type ValidatedPackageUpdate = {
	existingPackage: Doc<"packages">;
	updatedPackage: Parameters<typeof buildPackageUpdatePatch>[1];
};

export function loadAdminPackageUpdateValidation(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen((existingPackage) =>
			parsePackageUpdate(args).map((updatedPackage) => ({ existingPackage, updatedPackage }))
		)
		.andThen(({ existingPackage, updatedPackage }) =>
			getCapacityConsumingPackageSessions(
				ctx,
				existingPackage._id,
				existingPackage.packageSize
			).map((activeBookedSessions) => ({ activeBookedSessions, existingPackage, updatedPackage }))
		)
		.andThen(({ activeBookedSessions, existingPackage, updatedPackage }) =>
			validatePackageUpdate(args, updatedPackage, activeBookedSessions.length).map(() => ({
				existingPackage,
				updatedPackage
			}))
		);
}

export function writeAdminPackageFields(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	{ existingPackage, updatedPackage }: ValidatedPackageUpdate
) {
	const contactFields: PackageContactSearchFields = {
		name: updatedPackage.name,
		phone: updatedPackage.phone,
		accountName: updatedPackage.accountName,
		abn: updatedPackage.abn,
		email: updatedPackage.email.trim().toLowerCase(),
		instagramHandle: existingPackage.instagramHandle
	};

	return okOrThrow(
		ctx.db
			.patch("packages", args.packageId, {
				...buildPackageUpdatePatch(args, updatedPackage),
				...searchBlobPatchForPackage(existingPackage, {
					...contactFields,
					notes: updatedPackage.notes,
					receiptNumber: existingPackage.receiptNumber
				})
			})
			.then(async () => {
				const contactChanged =
					existingPackage.name !== contactFields.name ||
					existingPackage.phone !== contactFields.phone ||
					existingPackage.accountName !== contactFields.accountName ||
					existingPackage.abn !== contactFields.abn ||
					existingPackage.email !== contactFields.email;

				if (contactChanged) {
					await patchPackageSessionBookingsContactSearch(ctx, args.packageId, contactFields);
				}

				return null;
			})
	);
}

export function archivePackageFromAdmin(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen(() => setPackageArchived(ctx, args.packageId, args.archived));
}
