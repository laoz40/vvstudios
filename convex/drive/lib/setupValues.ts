import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type {
	StandaloneBooking,
	PackageBooking,
	ClientSessionNumberError,
	PackageSessionNumberError
} from "#convex/drive/lib/sessionFolders/allocateNumbers";

export function requireStandaloneBooking(
	booking: Doc<"bookings"> | null
): Result<Doc<"bookings">, ClientSessionNumberError> {
	if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" });

	if (booking.packageId !== undefined) return err({ reason: "BOOKING_IS_PACKAGE" });

	return ok(booking);
}

export function resolveStandaloneBooking(
	booking: Doc<"bookings">,
	client: Doc<"driveClients"> | null
): Result<StandaloneBooking, ClientSessionNumberError> {
	const driveClientId = booking.driveClientId ?? client?._id;

	if (driveClientId === undefined) return err({ reason: "DRIVE_RECORD_NOT_FOUND" });

	return ok({ booking, driveClientId });
}

export function requirePackageBooking(
	booking: Doc<"bookings"> | null
): Result<PackageBooking, PackageSessionNumberError> {
	if (booking === null) return err({ reason: "BOOKING_NOT_FOUND" });

	if (booking.packageId === undefined) return err({ reason: "BOOKING_NOT_PACKAGE" });

	return ok({ booking, packageId: booking.packageId });
}
