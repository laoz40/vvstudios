import { err, ok } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getAdminIdentityResult } from "../lib/auth";
import { getPackageFromDb } from "../lib/packageLookup";
import { okOrThrow } from "../lib/result";

type SavePackageInstagramHandleArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	instagramHandle: string;
};
type ArchivePackageArgs = { multiBookingId: Id<"multiBookingPackages">; archived: boolean };

export function savePackageInstagramHandleService(
	ctx: MutationCtx,
	args: SavePackageInstagramHandleArgs
) {
	return getPackageFromDb(ctx, args.multiBookingId)
		.andThen((multiBooking) => {
			if (multiBooking.status !== "pending_payment" && multiBooking.status !== "paid") {
				return err({ reason: "PACKAGE_NOT_ACTIVE" as const });
			}
			return ok(multiBooking);
		})
		.andThen((multiBooking) =>
			okOrThrow(
				ctx.db.patch(multiBooking._id, { instagramHandle: args.instagramHandle }).then(() => null)
			)
		);
}

export function archivePackageService(ctx: MutationCtx, args: ArchivePackageArgs) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, { hiddenAt: args.archived ? Date.now() : undefined })
					.then(() => null)
			)
		);
}
