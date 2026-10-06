import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageByIdForAction,
	lookupPackageRow,
	type PackageLookupError
} from "#convex/lib/packages/packageLookup";

function packageFromDbOrNotFound(packageFromDb: Doc<"packages"> | null) {
	if (!packageFromDb) {
		return err({ reason: "PACKAGE_NOT_FOUND" as const } satisfies PackageLookupError);
	}

	return ok(packageFromDb);
}

function packageFromActionOrNotFound(packageFromDb: Doc<"packages"> | null) {
	if (packageFromDb === null) {
		return err({ reason: "PACKAGE_NOT_FOUND" as const });
	}

	return ok(packageFromDb);
}

export function getPackageFromDb(ctx: QueryCtx | MutationCtx, packageId: Id<"packages">) {
	return lookupPackageRow(ctx, packageId).andThen(packageFromDbOrNotFound);
}

export function getPackageForAction(ctx: ActionCtx, packageId: Id<"packages">) {
	return lookupPackageByIdForAction(ctx, packageId).andThen(packageFromActionOrNotFound);
}
