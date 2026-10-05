import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageByIdForAction,
	lookupPackageRow,
	type PackageLookupError
} from "#convex/lib/packages/packageLookup";

export function getPackageFromDb(ctx: QueryCtx | MutationCtx, packageId: Id<"packages">) {
	return lookupPackageRow(ctx, packageId).andThen((packageFromDb) => {
		if (!packageFromDb) {
			return err({ reason: "PACKAGE_NOT_FOUND" as const } satisfies PackageLookupError);
		}

		return ok(packageFromDb);
	});
}

export function getPackageForAction(ctx: ActionCtx, packageId: Id<"packages">) {
	return lookupPackageByIdForAction(ctx, packageId).andThen((packageFromDb) => {
		if (packageFromDb === null) {
			return err({ reason: "PACKAGE_NOT_FOUND" as const });
		}

		return ok(packageFromDb);
	});
}
