import { ResultAsync } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { getPackageFromDb } from "../lib/packageLookup";

type ArchivePackageArgs = { multiBookingId: Id<"multiBookingPackages">; archived: boolean };

export function archivePackageService(ctx: MutationCtx, args: ArchivePackageArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen(() =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(args.multiBookingId, {
						hiddenAt: args.archived ? Date.now() : undefined
					});
					return null;
				})()
			)
		);
}
