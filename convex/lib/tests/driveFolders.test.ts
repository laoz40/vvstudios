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
 */
import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { shouldRecordDriveSetupFailure, validateDriveSetup } from "#convex/lib/driveSetup";
import {
	getClientFolderName,
	getPackageFolderName,
	getPackageSessionFolderName,
	getSessionFolderName
} from "#convex/lib/googleDrive";

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const bookingId = "booking-1" as Id<"bookings">;

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
