import type { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

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
