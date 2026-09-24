import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

type BookingArchiveFields = Pick<Doc<"bookings">, "archived">;

type PackageArchiveFields = Pick<Doc<"packages">, "archived">;

export function isBookingArchived(record: BookingArchiveFields): boolean {
	return record.archived;
}

export function isPackageArchived(record: PackageArchiveFields): boolean {
	return record.archived;
}

export function bookingArchivedPatch(): Pick<Doc<"bookings">, "archived"> {
	return { archived: true };
}

export function packageArchivedPatch(): Pick<Doc<"packages">, "archived"> {
	return { archived: true };
}

export async function setBookingArchived(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	archived: boolean
) {
	await ctx.db.patch(bookingId, { archived });
}

export async function setPackageArchived(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	archived: boolean
) {
	await ctx.db.patch(packageId, { archived });
}
