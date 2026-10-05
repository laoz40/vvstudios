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

function attachUpdatedPackage(
	existingPackage: Doc<"packages">,
	updatedPackage: ValidatedPackageUpdate["updatedPackage"]
) {
	return { existingPackage, updatedPackage };
}

function parseAdminPackageUpdate(args: UpdatePackageArgs, existingPackage: Doc<"packages">) {
	return parsePackageUpdate(args).map((updatedPackage: ValidatedPackageUpdate["updatedPackage"]) =>
		attachUpdatedPackage(existingPackage, updatedPackage)
	);
}

function attachActiveSessionsForUpdate(
	existingPackage: Doc<"packages">,
	updatedPackage: ValidatedPackageUpdate["updatedPackage"],

	activeBookedSessions: Doc<"bookings">[]
) {
	return { activeBookedSessions, existingPackage, updatedPackage };
}

function loadActiveSessionsForAdminUpdate(
	ctx: MutationCtx,
	{
		existingPackage,
		updatedPackage
	}: { existingPackage: Doc<"packages">; updatedPackage: ValidatedPackageUpdate["updatedPackage"] }
) {
	return getCapacityConsumingPackageSessions(
		ctx,
		existingPackage._id,
		existingPackage.packageSize
	).map((activeBookedSessions: Doc<"bookings">[]) =>
		attachActiveSessionsForUpdate(existingPackage, updatedPackage, activeBookedSessions)
	);
}

function toValidatedPackageUpdate(
	existingPackage: Doc<"packages">,
	updatedPackage: ValidatedPackageUpdate["updatedPackage"]
) {
	return { existingPackage, updatedPackage };
}

function validateAdminPackageUpdate(
	args: UpdatePackageArgs,
	{
		activeBookedSessions,
		existingPackage,
		updatedPackage
	}: {
		activeBookedSessions: Doc<"bookings">[];
		existingPackage: Doc<"packages">;
		updatedPackage: ValidatedPackageUpdate["updatedPackage"];
	}
) {
	return validatePackageUpdate(args, updatedPackage, activeBookedSessions.length).map(
		(validatedPackage: ValidatedPackageUpdate["updatedPackage"]) =>
			toValidatedPackageUpdate(existingPackage, validatedPackage)
	);
}

function loadPackageAfterEditPermission(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId);
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
	return getPackageFromDb(ctx, packageId);
}

function archivePackageWithPermission(ctx: MutationCtx, args: ArchivePackageArgs) {
	return setPackageArchived(ctx, args.packageId, args.archived);
}

function syncContactSearchAfterAdminPatchStep(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	contactChanged: boolean,
	contactFields: PackageContactSearchFields
) {
	return syncContactSearchAfterAdminPatch(ctx, args, contactChanged, contactFields);
}

export function loadAdminPackageUpdateValidation(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(() => loadPackageAfterEditPermission(ctx, args.packageId))
		.andThen((existingPackage: Doc<"packages">) => parseAdminPackageUpdate(args, existingPackage))
		.andThen((_value) => loadActiveSessionsForAdminUpdate(ctx, _value))
		.andThen((_value) => validateAdminPackageUpdate(args, _value));
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
	}).andThen(() => syncContactSearchAfterAdminPatchStep(ctx, args, contactChanged, contactFields));
}

export function archivePackageFromAdmin(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => loadPackageAfterArchivePermission(ctx, args.packageId))
		.andThen(() => archivePackageWithPermission(ctx, args));
}
