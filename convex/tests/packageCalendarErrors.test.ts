/**
 * Package Calendar actions preserve the operation's domain error.
 *
 * 1. Calendar creation and update
 *    Failed writes return create/update reasons rather than a generic sync reason.
 *
 * 2. Calendar deletion and availability
 *    Failed delete/read operations retain their reason; auth and rate limits stay distinct.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { google } from "googleapis";
import { internal } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const events = {
	list: vi.fn<() => Promise<Response>>(),
	get: vi.fn<() => Promise<Response>>(),
	insert: vi.fn<() => Promise<Response>>(),
	patch: vi.fn<() => Promise<Response>>(),
	delete: vi.fn<() => Promise<Response>>()
};

function sendCalendarRequest(input: RequestInfo | URL, init?: RequestInit) {
	const url = new URL(input instanceof Request ? input.url : input);
	const method = init?.method ?? "GET";

	if (method === "POST") return events.insert();

	if (method === "PATCH") return events.patch();

	if (method === "DELETE") return events.delete();

	return url.pathname.endsWith("/events") ? events.list() : events.get();
}

const details = {
	date: "2030-01-10",
	time: "10:00",
	duration: "1h" as const,
	email: "customer@example.com",
	name: "Customer",
	service: "Table Setup" as const,
	addons: [],
	eventBufferMinutes: 15
};

const session = {
	date: "2030-01-10",
	time: "10:00",
	duration: "1h",
	email: "customer@example.com",
	name: "Customer",
	googleCalendarId: "calendar",
	googleEventId: "event"
};

beforeEach(() => {
	const calendar = google.calendar({
		version: "v3",
		auth: "test-api-key",
		fetchImplementation: sendCalendarRequest,
		retry: false
	});

	vi.spyOn(google, "calendar").mockReturnValue(calendar);
	events.list.mockImplementation(() => Promise.resolve(Response.json({ items: [] })));
	events.get.mockImplementation(() => Promise.resolve(Response.json({ status: "confirmed" })));
	events.insert.mockImplementation(() => Promise.resolve(Response.json({ id: "new_event" })));
	events.patch.mockImplementation(() => Promise.resolve(Response.json({})));
	events.delete.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
});

afterEach(() => vi.restoreAllMocks());

describe("package Calendar operation errors", () => {
	test("preserves the create failure", async () => {
		const t = createConvexTest();
		events.insert.mockRejectedValue(new Error("Calendar unavailable"));

		expect(
			await t.action(internal.packageSchedulingCalendar.createPackageSessionCalendarEvent, {
				session: null,
				details
			})
		).toEqual([{ reason: "GOOGLE_CALENDAR_CREATE_FAILED" }, null]);
	});

	test("preserves the update failure", async () => {
		const t = createConvexTest();
		events.patch.mockRejectedValue(new Error("Calendar unavailable"));

		expect(
			await t.action(internal.packageSchedulingCalendar.updatePackageSessionCalendarEvent, {
				session,
				details
			})
		).toEqual([{ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" }, null]);
	});

	test("preserves the delete failure", async () => {
		const t = createConvexTest();
		events.delete.mockRejectedValue(new Error("Calendar unavailable"));

		expect(
			await t.action(internal.packageSchedulingCalendar.deletePackageSessionCalendarEvent, {
				session
			})
		).toEqual([{ reason: "GOOGLE_CALENDAR_DELETE_FAILED" }, null]);
	});

	test("preserves the availability failure before creating an event", async () => {
		const t = createConvexTest();
		events.list.mockRejectedValue(new Error("Calendar unavailable"));

		expect(
			await t.action(internal.packageSchedulingCalendar.createPackageSessionCalendarEvent, {
				session: null,
				details
			})
		).toEqual([{ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }, null]);
	});

	test.each([
		{ status: 401, reason: "GOOGLE_CALENDAR_AUTH_FAILED" },
		{ status: 429, reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	])("preserves $reason from Calendar creation", async ({ status, reason }) => {
		const t = createConvexTest();
		events.insert.mockImplementation(() =>
			Promise.resolve(Response.json({ error: "Rejected" }, { status }))
		);

		expect(
			await t.action(internal.packageSchedulingCalendar.createPackageSessionCalendarEvent, {
				session: null,
				details
			})
		).toEqual([{ reason }, null]);
	});
});
