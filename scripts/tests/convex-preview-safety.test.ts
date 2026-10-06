/*
Preview credentials
Accepts project preview keys and rejects absent/shared deployment keys.
Integration safety
Accepts test-only defaults, rejects live keys, missing defaults, other calendars,
other Drive folders, remote return URLs, and unconfirmed external integrations.
Private diagnostics
Errors name configuration fields without exposing their credential values.
*/
import { describe, expect, it } from "vitest";
import { validatePreviewIntegrations, validatePreviewKey } from "../convex-preview-safety";

const defaults = {
	CLERK_FRONTEND_API_URL: "https://example.clerk.accounts.dev",
	CLERK_SECRET_KEY: "sk_test_clerk-private",
	GOOGLE_CLIENT_ID: "test-client",
	GOOGLE_CLIENT_SECRET: "google-private",
	GOOGLE_REFRESH_TOKEN: "refresh-private",
	GOOGLE_DRIVE_ROOT_FOLDER_ID: "test-folder",
	GOOGLE_CALENDAR_ID: "test-calendar",
	GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
	GOOGLE_CALENDAR_HOST_EMAILS: "test@example.com",
	RESEND_API_KEY: "resend-private",
	RESEND_FROM_EMAIL: "test@example.com",
	STRIPE_SECRET_KEY: "sk_test_stripe-private",
	STRIPE_WEBHOOK_SECRET: "whsec_test-private",
	STRIPE_CHECKOUT_RETURN_URL: "http://localhost:3000/booking-complete"
};

const approved = { calendarId: "test-calendar", driveFolderId: "test-folder", confirmed: "true" };

const frontend = { stripeKey: "pk_test_stripe", clerkKey: "pk_test_clerk" };

it("accepts only project preview deploy keys", () => {
	expect(() => validatePreviewKey("preview:team:test-project|private-token")).not.toThrow();

	for (const key of [
		undefined,
		"",
		"prod:deployment|private-token",
		"dev:deployment|private-token",
		"preview:deployment|private-token"
	]) {
		expect(() => validatePreviewKey(key)).toThrow("project preview deploy key");
	}
});

it("accepts complete test-only defaults without seeding data", () => {
	expect(() => validatePreviewIntegrations(defaults, approved, frontend)).not.toThrow();
});

describe("unsafe backend defaults", () => {
	it.each([
		["STRIPE_SECRET_KEY", "sk_live_private"],
		["CLERK_SECRET_KEY", "sk_live_private"],
		["GOOGLE_CALENDAR_ID", "production-calendar"],
		["GOOGLE_CALENDAR_AVAILABILITY_IDS", "test-calendar,production-calendar"],
		["GOOGLE_DRIVE_ROOT_FOLDER_ID", "production-folder"],
		["STRIPE_CHECKOUT_RETURN_URL", "https://production.example/booking-complete"],
		["GOOGLE_REFRESH_TOKEN", ""]
	])("rejects unsafe %s without printing its value", (name, value) => {
		try {
			validatePreviewIntegrations({ ...defaults, [name]: value }, approved, frontend);
			throw new Error("Expected safety check to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect(String(error)).not.toContain("Expected safety check to fail");

			if (value) expect(String(error)).not.toContain(value);
		}
	});
});

it("rejects live frontend keys", () => {
	expect(() =>
		validatePreviewIntegrations(defaults, approved, { ...frontend, stripeKey: "pk_live_private" })
	).toThrow("test keys");
	expect(() =>
		validatePreviewIntegrations(defaults, approved, { ...frontend, clerkKey: "pk_live_private" })
	).toThrow("test keys");
});

it("requires approved calendar, Drive folder and external-account confirmation", () => {
	expect(() =>
		validatePreviewIntegrations(defaults, { ...approved, calendarId: undefined }, frontend)
	).toThrow("E2E_GOOGLE_CALENDAR_ID");
	expect(() =>
		validatePreviewIntegrations(defaults, { ...approved, driveFolderId: undefined }, frontend)
	).toThrow("E2E_GOOGLE_DRIVE_ROOT_FOLDER_ID");
	expect(() =>
		validatePreviewIntegrations(defaults, { ...approved, confirmed: undefined }, frontend)
	).toThrow("E2E_PREVIEW_INTEGRATIONS_CONFIRMED");
});
