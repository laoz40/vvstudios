/**
 * Feedback submit tests:
 *
 * 1. Successful submit
 *    Emails the studio once and returns null.
 * 2. Blank message
 *    Returns INVALID_MESSAGE and sends nothing.
 * 3. Rate limit
 *    Returns FEEDBACK_RATE_LIMITED after the global window is used up and sends nothing more.
 * 4. Resend request failure
 *    Returns the real EMAIL_REQUEST_FAILED reason.
 * 5. Resend rejects the email
 *    Returns the real EMAIL_RESPONSE_FAILED reason.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("feedback.submit", () => {
	test("emails the studio and returns null", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const t = createConvexTest();

		const result = await t.action(api.feedback.submit, { message: "  Loved the studio  " });

		expect(result).toEqual([null, null]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];

		expect(url).toBe("https://api.resend.com/emails");
		expect(JSON.stringify(init)).toContain("Loved the studio");
	});

	test("rejects a blank message without sending", async () => {
		const t = createConvexTest();

		const result = await t.action(api.feedback.submit, { message: "   " });

		expect(result).toEqual([{ reason: "INVALID_MESSAGE" }, null]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("rate limits after 25 submissions in the window", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
		const t = createConvexTest();

		await Promise.all(
			Array.from({ length: 25 }, () => t.action(api.feedback.submit, { message: "ok" }))
		);

		const limited = await t.action(api.feedback.submit, { message: "ok" });

		expect(limited).toEqual([{ reason: "FEEDBACK_RATE_LIMITED" }, null]);
		expect(fetchMock).toHaveBeenCalledTimes(25);
	});

	test("returns EMAIL_REQUEST_FAILED when the request throws", async () => {
		fetchMock.mockRejectedValue(new Error("network down"));
		const t = createConvexTest();

		const result = await t.action(api.feedback.submit, { message: "hello" });

		expect(result).toEqual([{ reason: "EMAIL_REQUEST_FAILED" }, null]);
	});

	test("returns EMAIL_RESPONSE_FAILED when Resend rejects the email", async () => {
		fetchMock.mockResolvedValue(new Response("bad key", { status: 401 }));
		const t = createConvexTest();

		const result = await t.action(api.feedback.submit, { message: "hello" });

		expect(result).toEqual([{ reason: "EMAIL_RESPONSE_FAILED" }, null]);
	});
});
