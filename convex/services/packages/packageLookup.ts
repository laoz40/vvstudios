import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageByIdForAction,
	lookupPackageRow,
	packageFromActionOrNotFound,
	packageFromDbOrNotFound
} from "#convex/lib/packages/packageLookup";

export function getPackageFromDb(ctx: QueryCtx | MutationCtx, packageId: Id<"packages">) {
	return lookupPackageRow(ctx, packageId).andThen(packageFromDbOrNotFound);
}

export function getPackageForAction(ctx: ActionCtx, packageId: Id<"packages">) {
	return lookupPackageByIdForAction(ctx, packageId).andThen(packageFromActionOrNotFound);
}
