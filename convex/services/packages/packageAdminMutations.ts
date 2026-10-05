import type { Doc } from "#convex/_generated/dataModel";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { setPackageArchived } from "#convex/lib/archiveState";
import { requirePermission } from "#convex/services/auth";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import {
	buildPackageUpdatePatch,
	parsePackageUpdate,
	patchAdminPackageRow,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "#convex/lib/packages/packageUpdates";
import {
	patchPackageSessionBookingsContactSearch,
	searchBlobPatchForPackage,
	type PackageContactSearchFields
} from "#convex/lib/adminSearch/adminSearchBlob";
import { okAsync, ResultAsync } from "neverthrow";

type ArchivePackageArgs = { packageId: Id<"packages">; archived: boolean };

type ValidatedPackageUpdate = {
	existingPackage: Doc<"packages">;
	updatedPackage: Parameters<typeof buildPackageUpdatePatch>[1];
};

function attachUpdatedPackage(existingPackage: Doc<"packages">) {
	return (updatedPackage: ValidatedPackageUpdate["updatedPackage"]) => ({
		existingPackage,
		updatedPackage
	});
}

function parseAdminPackageUpdate(args: UpdatePackageArgs) {
	return (existingPackage: Doc<"packages">) =>
		parsePackageUpdate(args).map(attachUpdatedPackage(existingPackage));
}

function attachActiveSessionsForUpdate(
	existingPackage: Doc<"packages">,
	updatedPackage: ValidatedPackageUpdate["updatedPackage"]
) {
	return (activeBookedSessions: Doc<"bookings">[]) => ({
		activeBookedSessions,
		existingPackage,
		updatedPackage
	});
}

function loadActiveSessionsForAdminUpdate(ctx: MutationCtx) {
	return ({
		existingPackage,
		updatedPackage
	}: {
		existingPackage: Doc<"packages">;
		updatedPackage: ValidatedPackageUpdate["updatedPackage"];
	}) =>
		getCapacityConsumingPackageSessions(ctx, existingPackage._id, existingPackage.packageSize).map(
			attachActiveSessionsForUpdate(existingPackage, updatedPackage)
		);
}

function toValidatedPackageUpdate(existingPackage: Doc<"packages">) {
	return (updatedPackage: ValidatedPackageUpdate["updatedPackage"]) => ({
		existingPackage,
		updatedPackage
	});
}

function validateAdminPackageUpdate(args: UpdatePackageArgs) {
	return ({
		activeBookedSessions,
		existingPackage,
		updatedPackage
	}: {
		activeBookedSessions: Doc<"bookings">[];
		existingPackage: Doc<"packages">;
		updatedPackage: ValidatedPackageUpdate["updatedPackage"];
	}) =>
		validatePackageUpdate(args, updatedPackage, activeBookedSessions.length).map(
			toValidatedPackageUpdate(existingPackage)
		);
}

function loadPackageAfterEditPermission(ctx: MutationCtx, packageId: Id<"packages">) {
	return () => getPackageFromDb(ctx, packageId);
}

function syncContactSearchAfterAdminPatch(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	contactChanged: boolean,
	contactFields: PackageContactSearchFields
) {
	if (!contactChanged) {
		return okAsync(null);
	}

	return ResultAsync.fromSafePromise(
		patchPackageSessionBookingsContactSearch(ctx, args.packageId, contactFields)
	).map(() => null);
}

function loadPackageAfterArchivePermission(ctx: MutationCtx, packageId: Id<"packages">) {
	return () => getPackageFromDb(ctx, packageId);
}

function archivePackageWithPermission(ctx: MutationCtx, args: ArchivePackageArgs) {
	return () => setPackageArchived(ctx, args.packageId, args.archived);
}

function syncContactSearchAfterAdminPatchStep(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	contactChanged: boolean,
	contactFields: PackageContactSearchFields
) {
	return () => syncContactSearchAfterAdminPatch(ctx, args, contactChanged, contactFields);
}

export function loadAdminPackageUpdateValidation(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(loadPackageAfterEditPermission(ctx, args.packageId))
		.andThen(parseAdminPackageUpdate(args))
		.andThen(loadActiveSessionsForAdminUpdate(ctx))
		.andThen(validateAdminPackageUpdate(args));
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

	const contactChanged =
		existingPackage.name !== contactFields.name ||
		existingPackage.phone !== contactFields.phone ||
		existingPackage.accountName !== contactFields.accountName ||
		existingPackage.abn !== contactFields.abn ||
		existingPackage.email !== contactFields.email;

	return patchAdminPackageRow(ctx, args.packageId, {
		...buildPackageUpdatePatch(args, updatedPackage),
		...searchBlobPatchForPackage(existingPackage, {
			...contactFields,
			notes: updatedPackage.notes,
			receiptNumber: existingPackage.receiptNumber
		})
	}).andThen(syncContactSearchAfterAdminPatchStep(ctx, args, contactChanged, contactFields));
}

export function archivePackageFromAdmin(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(loadPackageAfterArchivePermission(ctx, args.packageId))
		.andThen(archivePackageWithPermission(ctx, args));
}
