// Tests: normalizes the permanent client key; names client folders with account/contact fallback; formats Sydney session folders exactly.

import { describe, expect, test, vi } from "vitest";

vi.mock("#convex/env", () => ({
	env: {
		GOOGLE_CLIENT_ID: "client-id",
		GOOGLE_CLIENT_SECRET: "client-secret",
		GOOGLE_REFRESH_TOKEN: "refresh-token"
	}
}));

import {
	getClientFolderName,
	getSessionFolderName,
	normalizeDriveEmail
} from "#convex/lib/googleDrive";

describe("Google Drive folder naming", () => {
	test("normalizes the original booking email", () => {
		expect(normalizeDriveEmail("  Client@Example.COM ")).toBe("client@example.com");
	});

	test("uses the account name and falls back to the contact name", () => {
		expect(getClientFolderName({ accountName: "Acme", contactName: "Alex" })).toBe(
			"Acme (VV Studios)"
		);
		expect(getClientFolderName({ accountName: " ", contactName: " Alex " })).toBe(
			"Alex (VV Studios)"
		);
	});

	test("formats an ordinary session in Australia/Sydney", () => {
		const sessionStartAt = Date.parse("2026-08-13T00:00:00.000Z");
		expect(getSessionFolderName(sessionStartAt)).toBe("13 Aug 2026 — 10:00 AM");
	});
});
