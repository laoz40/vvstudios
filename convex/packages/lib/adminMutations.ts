import type { Doc, Id } from "#convex/_generated/dataModel";
import type { UpdatePackageArgs } from "#convex/packages/lib/updates";
import type { PackageContactSearchFields } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { searchBlobPatchForPackage } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { buildPackageUpdatePatch } from "#convex/packages/lib/updates";

export function buildAdminPackageContactFields(
	existingPackage: Doc<"packages">,
	updatedPackage: Parameters<typeof buildPackageUpdatePatch>[1]
): PackageContactSearchFields {
	return {
		name: updatedPackage.name,
		phone: updatedPackage.phone,
		accountName: updatedPackage.accountName,
		abn: updatedPackage.abn,
		email: updatedPackage.email.trim().toLowerCase(),
		instagramHandle: existingPackage.instagramHandle
	};
}

export function hasAdminPackageContactChanged(
	existingPackage: Doc<"packages">,
	contactFields: PackageContactSearchFields
) {
	return (
		existingPackage.name !== contactFields.name ||
		existingPackage.phone !== contactFields.phone ||
		existingPackage.accountName !== contactFields.accountName ||
		existingPackage.abn !== contactFields.abn ||
		existingPackage.email !== contactFields.email
	);
}

export function buildAdminPackagePatch(
	args: UpdatePackageArgs,
	existingPackage: Doc<"packages">,
	updatedPackage: Parameters<typeof buildPackageUpdatePatch>[1],
	contactFields: PackageContactSearchFields
) {
	return {
		...buildPackageUpdatePatch(args, updatedPackage),
		...searchBlobPatchForPackage(existingPackage, {
			...contactFields,
			notes: updatedPackage.notes,
			receiptNumber: existingPackage.receiptNumber
		})
	};
}

export function selectPackageContactSyncId(
	packageId: Id<"packages">,
	existingPackage: Doc<"packages">,
	contactFields: PackageContactSearchFields
) {
	return hasAdminPackageContactChanged(existingPackage, contactFields) ? packageId : null;
}
