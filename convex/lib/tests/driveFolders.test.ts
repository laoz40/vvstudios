/**
 * Drive folder naming and setup validation helpers.
 *
 * 1. Folder name formatting
 *    Formats stable Drive folder labels from session and package metadata.
 *
 * 2. validateDriveSetup
 *    Rejects missing, ineligible, or stale bookings before Drive work starts.
 *
 * 3. shouldRecordDriveSetupFailure
 *    Records only actionable setup failures on the booking row.
 *
 * 4. areDriveSetupFoldersSaved
 *    Treats setup as complete only when every required folder id is stored on the client and session rows.
 */
import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import {
	areDriveSetupFoldersSaved,
	shouldRecordDriveSetupFailure,
	validateDriveSetup,
	type DriveSetupInfo
} from "#convex/lib/driveSetup";
import {
	getClientFolderName,
	getPackageFolderName,
	getPackageSessionFolderName,
	getSessionFolderName
} from "#convex/lib/googleDrive";
import { testBookingId, testPackageId } from "#convex/lib/tests/testIds";

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const bookingId = testBookingId("booking-1");

// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
const driveClientId = "drive-client-1" as Id<"driveClients">;

// SAFETY: Convex ids are opaque strings at runtime; unit tests never persist these values.
const driveSessionId = "drive-session-1" as Id<"driveSessions">;

function savedFolder(id: string) {
	return { id, url: `https://drive.example/${id}` };
}

function completeDriveSetupInfo(overrides: Partial<DriveSetupInfo> = {}): DriveSetupInfo {
	const folder = savedFolder("folder-1");

	return {
		booking: {
			_id: bookingId,
			name: "Test customer",
			accountName: "Acme",
			email: "customer@example.com",
			sessionStartAt,
			duration: "1h",
			status: "confirmed"
		},
		packageRecord: null,
		driveClient: {
			_id: driveClientId,
			normalizedEmail: "customer@example.com",
			displayName: "Test customer",
			folderId: "client-folder",
			assetsFolder: folder
		},
		driveSession: {
			_id: driveSessionId,
			sessionFolder: folder,
			rawMediaFolder: folder,
			deliverablesFolder: folder
		},
		...overrides
	};
}

function setupInfo(
	overrides: Partial<{
		status: "confirmed" | "cancelled" | "email_failed";
		sessionStartAt: number;
		duration: string;
	}> = {}
) {
	return {
		booking: {
			_id: bookingId,
			name: "Test customer",
			accountName: "Acme",
			email: "customer@example.com",
			sessionStartAt,
			duration: "1h",
			status: "confirmed" as const,
			...overrides
		},
		packageRecord: null,
		driveClient: null,
		driveSession: null
	};
}

describe("drive folder names", () => {
	test("formats client, session, and package folder names", () => {
		expect(getClientFolderName({ accountName: " Acme ", contactName: "Bob" })).toBe(
			"Acme (VV Studios)"
		);
		expect(getSessionFolderName(sessionStartAt)).toBe("10 Jan 2030 - 10:00 AM");
		expect(getPackageFolderName({ packageSize: 4, purchasedAt: sessionStartAt })).toBe(
			"4-Session Package - Ordered on 10 Jan 2030"
		);
		expect(getPackageSessionFolderName(2, sessionStartAt)).toBe(
			"Session 02 - 10 Jan 2030 - 10:00 AM"
		);
	});
});

describe("validateDriveSetup", () => {
	test("rejects a missing booking", () => {
		const result = validateDriveSetup(null);

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_NOT_FOUND" });
		}
	});

	test("rejects ineligible booking statuses", () => {
		const result = validateDriveSetup(setupInfo({ status: "cancelled" }));

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_NOT_ELIGIBLE" });
		}
	});

	test("rejects stale booking timing", () => {
		const result = validateDriveSetup(setupInfo(), {
			sessionStartAt: sessionStartAt + 60 * 60 * 1000,
			duration: "1h"
		});

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_TIMING_CHANGED" });
		}
	});
});

describe("shouldRecordDriveSetupFailure", () => {
	test("records actionable provider failures but skips auth and eligibility failures", () => {
		expect(shouldRecordDriveSetupFailure({ reason: "GOOGLE_DRIVE_FOLDER_CREATE_FAILED" })).toBe(
			true
		);
		expect(shouldRecordDriveSetupFailure({ reason: "NOT_AUTHORIZED" })).toBe(false);
		expect(shouldRecordDriveSetupFailure({ reason: "BOOKING_NOT_ELIGIBLE" })).toBe(false);
	});
});

describe("areDriveSetupFoldersSaved", () => {
	test("returns false when setup info is missing", () => {
		expect(areDriveSetupFoldersSaved(null)).toBe(false);
	});

	test("returns true when single-session folders are all saved", () => {
		expect(areDriveSetupFoldersSaved(completeDriveSetupInfo())).toBe(true);
	});

	test("returns false when raw media or deliverables folders are missing", () => {
		const folder = savedFolder("session-folder");

		expect(
			areDriveSetupFoldersSaved(
				completeDriveSetupInfo({
					driveSession: { _id: driveSessionId, sessionFolder: folder, deliverablesFolder: folder }
				})
			)
		).toBe(false);
	});

	test("returns false for package bookings without a package folder reference", () => {
		expect(
			areDriveSetupFoldersSaved(
				completeDriveSetupInfo({
					packageRecord: {
						_id: testPackageId("package-1"),
						packageSize: 4,
						createdAt: sessionStartAt
					}
				})
			)
		).toBe(false);
	});

	test("returns true for package bookings with a shared package folder", () => {
		expect(
			areDriveSetupFoldersSaved(
				completeDriveSetupInfo({
					packageRecord: {
						_id: testPackageId("package-1"),
						packageSize: 4,
						createdAt: sessionStartAt
					},
					sharedPackageFolder: savedFolder("package-folder")
				})
			)
		).toBe(true);
	});
});
