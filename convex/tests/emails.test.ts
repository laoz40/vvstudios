/**
 * Email tests:
 * 1. Deliverables emails reject anonymous and unauthorized callers without sending.
 * 2. Missing bookings and invalid Drive links are rejected without sending.
 * 3. Admin sends include normalized booking details and optional editor notes.
 * 4. Assigned editors can send deliverables emails for eligible sessions.
 * 5. Editors cannot send for unassigned sessions or sessions assigned to another editor.
 * 6. Editors cannot send for future, archived, or unconfirmed sessions.
 * 7. Deliverables provider failures return a stable error.
 * 8. Blank and rate-limited feedback is rejected without sending.
 * 9. Valid feedback is trimmed before sending.
 * 10. Untrusted feedback is escaped in the provider HTML payload.
 * 11. Feedback provider failures return a stable error.
 */
import type { UserIdentity } from "convex/server";
import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({
	rateLimit: vi.fn(),
	sendDeliverablesEmail: vi.fn(),
	sendFeedbackEmail: vi.fn()
}));

vi.mock("#convex/env", () => ({
	env: {
		GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney",
		RESEND_API_KEY: "test-key",
		RESEND_FROM_EMAIL: "studio@example.com"
	}
}));

vi.mock("#convex/lib/email", () => ({
	sendSessionDeliverablesEmail: providerFakes.sendDeliverablesEmail,
	sendFeedbackEmailForMessage: providerFakes.sendFeedbackEmail
}));

vi.mock("#convex/lib/rateLimits", () => ({ rateLimiter: { limit: providerFakes.rateLimit } }));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };
const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-one",
	subject: "editor-one",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};
const otherEditorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-two",
	subject: "editor-two",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};
const validDriveLink = "https://drive.google.com/drive/folders/folder-id";

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	providerFakes.rateLimit.mockResolvedValue({ ok: true });
	providerFakes.sendDeliverablesEmail.mockReturnValue(okAsync(null));
	providerFakes.sendFeedbackEmail.mockResolvedValue(okAsync(null));
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

		expect(result).toEqual([null, null]);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledWith({
			date: "2020-01-10",
			driveLink: `${validDriveLink}/?usp=sharing`,
			editorNotes: "Final mix included",
			email: "customer@example.com",
			emailVariant: "recurring",
			name: "Deliverables customer"
		});
	});

	test("allows an assigned editor to send for an eligible session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		const result = await t
			.withIdentity(editorIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: validDriveLink,
				emailVariant: "first-time"
			});

		expect(result).toEqual([null, null]);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledWith(
			expect.objectContaining({ email: "customer@example.com", name: "Deliverables customer" })
		);
	});

	test.each([
		{ label: "an unassigned session", options: {}, reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" },
		{
			label: "another editor's session",
			options: { assignedEditorTokenIdentifier: otherEditorIdentity.tokenIdentifier },
			reason: "SESSION_NOT_ASSIGNED_TO_EDITOR"
		},
		{
			label: "a future session",
			options: {
				assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
				sessionStartAt: Date.parse("2100-01-01T00:00:00.000Z")
			},
			reason: "SESSION_NOT_IN_PAST"
		},
		{
			label: "an archived session",
			options: {
				assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
				hiddenAt: Date.parse("2020-01-10T00:00:00.000Z")
			},
			reason: "SESSION_ARCHIVED"
		},
		{
			label: "an unconfirmed session",
			options: {
				assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
				status: "pending_payment" as const
			},
			reason: "SESSION_NOT_CONFIRMED"
		}
	])("rejects an editor send for $label without sending", async ({ options, reason }) => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, options);

		const result = await t
			.withIdentity(editorIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				driveLink: validDriveLink,
				emailVariant: "first-time"
			});

		expect(result).toEqual([{ reason }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("returns the stable failure when the provider cannot send", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		providerFakes.sendDeliverablesEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

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
			await vi.importActual<typeof import("#convex/lib/email")>("#convex/lib/email");

		const result = await sendFeedbackEmailForMessage("<script>alert('unsafe')</script>\nNext");
		const requestBody = fetchFake.mock.calls[0]?.[1]?.body;

		if (typeof requestBody !== "string") {
			throw new Error("Expected the email request body to be JSON");
		}

		expect(result.isOk()).toBe(true);
		expect(requestBody).toContain("&lt;script&gt;alert(&#39;unsafe&#39;)&lt;/script&gt;<br />Next");
		expect(requestBody).not.toContain("<script>");
		vi.unstubAllGlobals();
	});

	test("returns SEND_FAILED when the provider cannot send", async () => {
		const t = createConvexTest();
		providerFakes.sendFeedbackEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

		const result = await t.action(api.feedback.submit, { message: "Useful feedback" });

		expect(result).toEqual([{ reason: "SEND_FAILED" }, null]);
		expect(providerFakes.sendFeedbackEmail).toHaveBeenCalledTimes(1);
	});
});

type BookingOptions = {
	assignedEditorTokenIdentifier?: string;
	hiddenAt?: number;
	sessionStartAt?: number;
	status?: "confirmed" | "pending_payment";
};

async function seedEditorProfile(t: TestClient, identity: UserIdentity): Promise<void> {
	await t.run((ctx) =>
		ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName: identity.subject,
			email: `${identity.subject}@example.com`,
			isActive: true
		})
	);
}

async function seedBooking(t: TestClient, options: BookingOptions = {}) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Deliverables customer",
			phone: "0400000000",
			accountName: "Deliverables account",
			email: "customer@example.com",
			date: "2020-01-10",
			time: "10:00",
			sessionStartAt: options.sessionStartAt ?? Date.parse("2020-01-09T23:00:00.000Z"),
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: options.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			assignedEditorTokenIdentifier: options.assignedEditorTokenIdentifier,
			hiddenAt: options.hiddenAt
		})
	);
}

async function seedThenDeleteBooking(t: TestClient): Promise<Id<"bookings">> {
	const bookingId = await seedBooking(t);
	await t.run((ctx) => ctx.db.delete(bookingId));
	return bookingId;
}
