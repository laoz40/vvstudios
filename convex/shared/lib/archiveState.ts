import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

export function isBookingArchived(record: Pick<Doc<"bookings">, "archived">) {
	return record.archived;
}

export function isPackageArchived(record: Pick<Doc<"packages">, "archived">) {
	return record.archived;
}

export function setBookingArchived(ctx: MutationCtx, bookingId: Id<"bookings">, archived: boolean) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, { archived }).then(() => null));
}

export function setPackageArchived(ctx: MutationCtx, packageId: Id<"packages">, archived: boolean) {
	return okOrThrow(ctx.db.patch("packages", packageId, { archived }).then(() => null));
}
