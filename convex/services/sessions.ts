import { ResultAsync } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { getSessionFromDbResult } from "../lib/sessionLookup";

type ArchiveSessionArgs = { bookingId: Id<"bookings">; archived: boolean };

export function archiveSessionService(ctx: MutationCtx, args: ArchiveSessionArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getSessionFromDbResult(ctx, args.bookingId))
		.andThen(() =>
			ResultAsync.fromSafePromise(
				(async () => {
					await ctx.db.patch(args.bookingId, { hiddenAt: args.archived ? Date.now() : undefined });
					return null;
				})()
			)
		);
}
