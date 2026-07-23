/**
 * These tests cover the manual deliverables email sent by an administrator.
 *
 * Unauthorized users, missing bookings, and invalid Google Drive links must not call the email
 * provider. A valid request sends the booking's customer details and normalized Drive link, while
 * provider failures return the stable recoverable error.
 *
 * These tests also cover public feedback submissions. Blank and rate-limited messages must not send;
 * valid untrusted content reaches the escaping email boundary, and provider failures remain stable.
 * Email delivery is replaced with controlled fakes.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({
	rateLimit: vi.fn(),
	sendDeliverablesEmail: vi.fn(),
	sendFeedbackEmail: vi.fn()
}));

vi.mock("../env", () => ({
	env: {
		GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
		RESEND_API_KEY: "test-key",
		RESEND_FROM_EMAIL: "studio@example.com"
	}
}));

vi.mock("../lib/email", () => ({
	sendSessionDeliverablesEmail: providerFakes.sendDeliverablesEmail,
	sendFeedbackEmailForMessage: providerFakes.sendFeedbackEmail
}));

vi.mock("../lib/rateLimits", () => ({ rateLimiter: { limit: providerFakes.rateLimit } }));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };
const validDriveLink = "https://drive.google.com/drive/folders/folder-id";

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	providerFakes.rateLimit.mockResolvedValue({ ok: true });
	providerFakes.sendDeliverablesEmail.mockResolvedValue([null, { sent: true }]);
	providerFakes.sendFeedbackEmail.mockResolvedValue([null, { sent: true }]);
});

describe("deliverables email", () => {
	test.each([
		{ label: "anonymous users", identity: null, reason: "NOT_AUTHENTICATED" },
		{
			label: "non-admin users",
			identity: { publicMetadata: { role: "customer" } },
			reason: "NOT_AUTHORIZED"
		}
	])("rejects $label without sending", async ({ identity, reason }) => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const client = identity === null ? t : t.withIdentity(identity);

		const result = await client.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
			bookingId,
			driveLink: validDriveLink,
			emailVariant: "first-time"
		});

		expect(result).toEqual([{ reason }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("rejects a missing booking and invalid Drive link without sending", async () => {
		const missingBookingTest = createConvexTest();
		const missingBookingId = await seedThenDeleteBooking(missingBookingTest);
		const invalidLinkTest = createConvexTest();
		const bookingId = await seedBooking(invalidLinkTest);

		const missingResult = await missingBookingTest
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId: missingBookingId,
				driveLink: validDriveLink,
				emailVariant: "first-time"
			});
		const invalidLinkResult = await invalidLinkTest
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: "https://example.com/not-drive",
				emailVariant: "first-time"
			});

		expect(missingResult).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(invalidLinkResult).toEqual([{ reason: "INVALID_DRIVE_LINK" }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("sends normalized booking details and optional editor notes", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: `${validDriveLink}/?usp=sharing`,
				editorNotes: "Final mix included",
				emailVariant: "recurring"
			});

		expect(result).toEqual([null, { sent: true }]);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledWith({
			date: "2030-01-10",
			driveLink: `${validDriveLink}/?usp=sharing`,
			editorNotes: "Final mix included",
			email: "customer@example.com",
			emailVariant: "recurring",
			name: "Deliverables customer"
		});
	});

	test("returns the stable failure when the provider cannot send", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.sendDeliverablesEmail.mockResolvedValueOnce([
			{ reason: "EMAIL_REQUEST_FAILED" },
			null
		]);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: validDriveLink,
				emailVariant: "first-time"
			});

		expect(result).toEqual([{ reason: "DELIVERABLES_SEND_FAILED" }, null]);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledTimes(1);
	});
});

describe("feedback email", () => {
	test("rejects blank and rate-limited messages without sending", async () => {
		const blankTest = createConvexTest();
		const rateLimitedTest = createConvexTest();

		const blankResult = await blankTest.action(api.feedback.submit, { message: "   \n " });
		providerFakes.rateLimit.mockResolvedValueOnce({ ok: false });
		const rateLimitedResult = await rateLimitedTest.action(api.feedback.submit, {
			message: "Useful feedback"
		});

		expect(blankResult).toEqual([{ reason: "INVALID_MESSAGE" }, null]);
		expect(rateLimitedResult).toEqual([{ reason: "FEEDBACK_RATE_LIMITED" }, null]);
		expect(providerFakes.rateLimit).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendFeedbackEmail).not.toHaveBeenCalled();
	});

	test("trims valid untrusted content before sending", async () => {
		const t = createConvexTest();
		const message = "  <script>alert('unsafe')</script>\nHelpful note  ";

		const result = await t.action(api.feedback.submit, { message });

		expect(result).toEqual([null, { submitted: true }]);
		expect(providerFakes.rateLimit).toHaveBeenCalledWith(expect.anything(), "feedbackSubmitGlobal");
		expect(providerFakes.sendFeedbackEmail).toHaveBeenCalledWith(
			"<script>alert('unsafe')</script>\nHelpful note"
		);
	});

	test("escapes untrusted feedback in the provider HTML payload", async () => {
		const fetchFake = vi.fn<typeof fetch>().mockResolvedValue(new Response());
		vi.stubGlobal("fetch", fetchFake);
		const { sendFeedbackEmailForMessage } =
			await vi.importActual<typeof import("../lib/email")>("../lib/email");

		const result = await sendFeedbackEmailForMessage("<script>alert('unsafe')</script>\nNext");
		const requestBody = fetchFake.mock.calls[0]?.[1]?.body;

		if (typeof requestBody !== "string") {
			throw new Error("Expected the email request body to be JSON");
		}

		expect(result).toEqual([null, { sent: true }]);
		expect(requestBody).toContain("&lt;script&gt;alert(&#39;unsafe&#39;)&lt;/script&gt;<br />Next");
		expect(requestBody).not.toContain("<script>");
		vi.unstubAllGlobals();
	});

	test("returns SEND_FAILED when the provider cannot send", async () => {
		const t = createConvexTest();
		providerFakes.sendFeedbackEmail.mockResolvedValueOnce([
			{ reason: "EMAIL_REQUEST_FAILED" },
			null
		]);

		const result = await t.action(api.feedback.submit, { message: "Useful feedback" });

		expect(result).toEqual([{ reason: "SEND_FAILED" }, null]);
		expect(providerFakes.sendFeedbackEmail).toHaveBeenCalledTimes(1);
	});
});

async function seedBooking(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Deliverables customer",
			phone: "0400000000",
			accountName: "Deliverables account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: Date.parse("2030-01-09T23:00:00.000Z"),
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now
		})
	);
}

async function seedThenDeleteBooking(t: TestClient): Promise<Id<"bookings">> {
	const bookingId = await seedBooking(t);
	await t.run((ctx) => ctx.db.delete(bookingId));
	return bookingId;
}
