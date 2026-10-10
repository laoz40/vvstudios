import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageByIdForAction,
	lookupPackageRow,
	packageFromActionOrNotFound,
	packageFromDbOrNotFound
} from "#convex/packages/lib/lookup";

export function getPackageFromDb(ctx: QueryCtx | MutationCtx, packageId: Id<"packages">) {
	return lookupPackageRow(ctx, packageId).andThen(packageFromDbOrNotFound);
}

export function getPackageForAction(ctx: ActionCtx, packageId: Id<"packages">) {
	return lookupPackageByIdForAction(ctx, packageId).andThen(packageFromActionOrNotFound);
}

export async function queryPackageByIdOrNull(
	ctx: QueryCtx,
	packageId: Id<"packages">
): Promise<Doc<"packages"> | null> {
	const packageFromDbResult = await getPackageFromDb(ctx, packageId);

	return packageFromDbResult.match(
		(packageFromDb) => packageFromDb,
		() => null
	);
}
