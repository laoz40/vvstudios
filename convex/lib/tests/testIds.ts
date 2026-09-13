import type { UserIdentity } from "convex/server";
import type { Id } from "#convex/_generated/dataModel";

export function testBookingId(value: string): Id<"bookings"> {
	// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
	return value as Id<"bookings">;
}

export function testPackageId(value: string): Id<"packages"> {
	// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
	return value as Id<"packages">;
}

export function testPackageAdjustmentId(value: string): Id<"packageAdjustments"> {
	// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
	return value as Id<"packageAdjustments">;
}

export function testUserIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
	// SAFETY: Unit tests only read tokenIdentifier from the identity object.
	return { tokenIdentifier: "editor-1", ...overrides } as UserIdentity;
}
