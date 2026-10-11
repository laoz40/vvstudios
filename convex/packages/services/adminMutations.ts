import type { Doc } from "#convex/_generated/dataModel";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { setPackageArchived } from "#convex/shared/lib/archiveState";
import { requirePermission } from "#convex/shared/services/auth";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	buildPackageUpdatePatch,
	parsePackageUpdate,
	patchAdminPackageRow,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "#convex/packages/lib/updates";
import {
	buildAdminPackageContactFields,
	buildAdminPackagePatch,
	selectPackageContactSyncId
} from "#convex/packages/lib/adminMutations";
import { patchPackageSessionBookingsContactSearch } from "#convex/shared/services/adminSearch";

type ArchivePackageArgs = { packageId: Id<"packages">; archived: boolean };

type ValidatedPackageUpdate = {
	existingPackage: Doc<"packages">;
	updatedPackage: Parameters<typeof buildPackageUpdatePatch>[1];
};

function parseAdminPackageUpdate(args: UpdatePackageArgs, existingPackage: Doc<"packages">) {
	return parsePackageUpdate(args).map(
		(updatedPackage: ValidatedPackageUpdate["updatedPackage"]) => ({
			existingPackage,
			updatedPackage
		})
	);
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
	).map((activeBookedSessions: Doc<"bookings">[]) => ({
		activeBookedSessions,
		existingPackage,
		updatedPackage
	}));
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
		(validatedPackage: ValidatedPackageUpdate["updatedPackage"]) => ({
			existingPackage,
			updatedPackage: validatedPackage
		})
	);
}

export function loadAdminPackageUpdateValidation(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen((existingPackage: Doc<"packages">) => parseAdminPackageUpdate(args, existingPackage))
		.andThen((_value) => loadActiveSessionsForAdminUpdate(ctx, _value))
		.andThen((_value) => validateAdminPackageUpdate(args, _value));
}

export function writeAdminPackageFields(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	{ existingPackage, updatedPackage }: ValidatedPackageUpdate
) {
	const contactFields = buildAdminPackageContactFields(existingPackage, updatedPackage);
	const contactSyncId = selectPackageContactSyncId(args.packageId, existingPackage, contactFields);

	return patchAdminPackageRow(
		ctx,
		args.packageId,
		buildAdminPackagePatch(args, existingPackage, updatedPackage, contactFields)
	).andThen(() => patchPackageSessionBookingsContactSearch(ctx, contactSyncId, contactFields));
}

export function archivePackageFromAdmin(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen(() => setPackageArchived(ctx, args.packageId, args.archived));
}
