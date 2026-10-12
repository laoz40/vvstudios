import { ok, safeTry } from "neverthrow";
import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageByIdForAction,
	lookupPackageRow,
	lookupPackageRowForQuery,
	packageFromActionOrNotFound,
	packageFromDbOrNotFound,
	type PackageLookupError
} from "#convex/packages/lib/lookup";

export function getPackageFromDb(ctx: QueryCtx | MutationCtx, packageId: Id<"packages">) {
	return safeTry(async function* () {
		const packageRow = yield* lookupPackageRow(ctx, packageId);
		const packageRecord = yield* packageFromDbOrNotFound(packageRow);

		return ok(packageRecord);
	});
}

export function getPackageForAction(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<Doc<"packages">, PackageLookupError> {
	return safeTry(async function* () {
		const packageLookup = yield* lookupPackageByIdForAction(ctx, packageId);
		const packageRecord = yield* packageFromActionOrNotFound(packageLookup);

		return ok(packageRecord);
	});
}

export async function queryPackageByIdOrNull(ctx: QueryCtx, packageId: Id<"packages">) {
	return lookupPackageRowForQuery(ctx, packageId);
}
