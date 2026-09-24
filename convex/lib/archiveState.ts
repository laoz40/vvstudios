import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

type BookingArchiveFields = Pick<Doc<"bookings">, "archived" | "hiddenAt">;

type PackageArchiveFields = Pick<Doc<"packages">, "archived" | "hiddenAt">;

/** Dual-read until PR2 drops hiddenAt. */
export function isBookingArchived(record: BookingArchiveFields): boolean {
	return record.archived === true || record.hiddenAt !== undefined;
}

/** Dual-read until PR2 drops hiddenAt. */
export function isPackageArchived(record: PackageArchiveFields): boolean {
	return record.archived === true || record.hiddenAt !== undefined;
}

export function bookingArchivedPatch(
	now = Date.now()
): Pick<Doc<"bookings">, "archived" | "hiddenAt"> {
	return { archived: true, hiddenAt: now };
}

export function packageArchivedPatch(
	now = Date.now()
): Pick<Doc<"packages">, "archived" | "hiddenAt"> {
	return { archived: true, hiddenAt: now };
}

/** Dual-write archive flag until PR2 drops hiddenAt. */
export async function setBookingArchived(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	archived: boolean,
	now = Date.now()
) {
	if (archived) {
		await ctx.db.patch(bookingId, bookingArchivedPatch(now));

		return;
	}

	await ctx.db.patch(bookingId, { hiddenAt: undefined });
	await ctx.db.patch(bookingId, { archived: false });
}

/** Dual-write archive flag until PR2 drops hiddenAt. */
export async function setPackageArchived(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	archived: boolean,
	now = Date.now()
) {
	if (archived) {
		await ctx.db.patch(packageId, packageArchivedPatch(now));

		return;
	}

	await ctx.db.patch(packageId, { hiddenAt: undefined });
	await ctx.db.patch(packageId, { archived: false });
}
