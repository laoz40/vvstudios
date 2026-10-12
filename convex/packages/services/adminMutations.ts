import { ok, safeTry } from "neverthrow";
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
	return safeTry(function* () {
		const updatedPackage = yield* parsePackageUpdate(args);

		return ok({ existingPackage, updatedPackage });
	});
}

function loadActiveSessionsForAdminUpdate(
	ctx: MutationCtx,
	{
		existingPackage,
		updatedPackage
	}: { existingPackage: Doc<"packages">; updatedPackage: ValidatedPackageUpdate["updatedPackage"] }
) {
	return safeTry(async function* () {
		const activeBookedSessions = yield* getCapacityConsumingPackageSessions(
			ctx,
			existingPackage._id,
			existingPackage.packageSize
		);

		return ok({ activeBookedSessions, existingPackage, updatedPackage });
	});
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
	return safeTry(function* () {
		const validatedPackage = yield* validatePackageUpdate(
			args,
			updatedPackage,
			activeBookedSessions.length
		);

		return ok({ existingPackage, updatedPackage: validatedPackage });
	});
}

export function loadAdminPackageUpdateValidation(ctx: MutationCtx, args: UpdatePackageArgs) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "edit:sessions");
		const existingPackage = yield* getPackageFromDb(ctx, args.packageId);
		const parsedUpdate = yield* parseAdminPackageUpdate(args, existingPackage);
		const activeSessions = yield* loadActiveSessionsForAdminUpdate(ctx, parsedUpdate);
		const validatedUpdate = yield* validateAdminPackageUpdate(args, activeSessions);

		return ok(validatedUpdate);
	});
}

export function writeAdminPackageFields(
	ctx: MutationCtx,
	args: UpdatePackageArgs,
	{ existingPackage, updatedPackage }: ValidatedPackageUpdate
) {
	const contactFields = buildAdminPackageContactFields(existingPackage, updatedPackage);
	const contactSyncId = selectPackageContactSyncId(args.packageId, existingPackage, contactFields);

	return safeTry(async function* () {
		yield* patchAdminPackageRow(
			ctx,
			args.packageId,
			buildAdminPackagePatch(args, existingPackage, updatedPackage, contactFields)
		);

		const updatedBookings = yield* patchPackageSessionBookingsContactSearch(
			ctx,
			contactSyncId,
			contactFields
		);

		return ok(updatedBookings);
	});
}

export function archivePackageFromAdmin(ctx: MutationCtx, args: ArchivePackageArgs) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "archive:sessions");
		yield* getPackageFromDb(ctx, args.packageId);
		const archived = yield* setPackageArchived(ctx, args.packageId, args.archived);

		return ok(archived);
	});
}
