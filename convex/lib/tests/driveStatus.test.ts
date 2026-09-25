/**
 * Drive admin status for client folder permissions.
 *
 * 1. Dismissed client folder
 *    Sessions show skipped even when the session row still says failed.
 */
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { dismissedClientFolderPermission } from "#convex/lib/driveClientAccess";
import { buildClientDrivePermissionsStatus } from "#convex/lib/driveStatus";
import { testBookingId } from "#convex/lib/tests/testIds";

// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
const driveClientId = "drive-client-1" as Id<"driveClients">;

// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
const driveSessionId = "drive-session-1" as Id<"driveSessions">;

const bookingId = testBookingId("booking-1");

describe("client drive permissions status", () => {
	test("treats dismissed client folder sharing as skipped", () => {
		// SAFETY: Unit tests only pass drive client fields read by client permissions status helpers.
		const driveClient = {
			_id: driveClientId,
			clientFolderPermission: dismissedClientFolderPermission
		} as Doc<"driveClients">;

		// SAFETY: Unit tests only pass drive session fields read by client permissions status helpers.
		const driveSession = {
			_id: driveSessionId,
			bookingId,
			driveClientId,
			clientDrivePermissionsStatus: "failed",
			createdAt: 0,
			updatedAt: 0
		} as Doc<"driveSessions">;

		expect(buildClientDrivePermissionsStatus(driveClient, driveSession, null)).toMatchObject({
			status: "skipped"
		});
	});
});
