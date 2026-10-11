import type { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export function isBookingArchived(record: Pick<Doc<"bookings">, "archived">): boolean {
	return record.archived;
}

export function isPackageArchived(record: Pick<Doc<"packages">, "archived">): boolean {
	return record.archived;
}

export function setBookingArchived(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	archived: boolean
): ResultAsync<null, never> {
	return okOrThrow(ctx.db.patch("bookings", bookingId, { archived }).then(() => null));
}

export function setPackageArchived(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	archived: boolean
): ResultAsync<null, never> {
	return okOrThrow(ctx.db.patch("packages", packageId, { archived }).then(() => null));
}
