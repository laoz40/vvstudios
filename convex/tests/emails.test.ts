/**
 * Email tests:
 *
 * 1. Missing booking and missing Deliverables folder
 *    Missing bookings and sessions without a saved Deliverables folder are rejected without sending.
 *
 * 2. Empty Deliverables folder
 *    An empty saved folder is rejected without sending.
 *
 * 3. Deliverables listing failure
 *    A Drive list failure is rejected without sending.
 *
 * 4. Admin deliverables email
 *    Admin sends use the saved folder URL, detected customer type, and optional editor notes.
 *    Sending always adds anyone-with-the-link viewer access on the Deliverables folder.
 *
 * 5. Completed session skip
 *    A session already marked completed does not send again.
 *
 * 6. Deliverables provider failure
 *    Provider failures return a stable error.
 *
 * 7. Feedback validation
 *    Blank and rate-limited feedback is rejected without sending.
 *
 * 8. Feedback provider failure
 *     Provider failures return a stable error.
 */
import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({
	ensureAnyoneReaderPermission: vi.fn(),
	listDriveFolderChildren: vi.fn(),
	loadDriveClient: vi.fn(),
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

vi.mock("#convex/lib/googleDrive", () => ({
	ensureAnyoneReaderPermission: providerFakes.ensureAnyoneReaderPermission,
	listDriveFolderChildren: providerFakes.listDriveFolderChildren,
	loadDriveClient: providerFakes.loadDriveClient
}));

vi.mock("#convex/lib/rateLimits", () => ({ rateLimiter: { limit: providerFakes.rateLimit } }));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };
const savedDeliverablesFolder = {
	id: "deliverables-folder-id",
	url: "https://drive.google.com/drive/folders/deliverables-folder-id"
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	providerFakes.rateLimit.mockResolvedValue({ ok: true });
	providerFakes.loadDriveClient.mockReturnValue(okAsync({}));
	providerFakes.ensureAnyoneReaderPermission.mockReturnValue(okAsync(null));
	providerFakes.listDriveFolderChildren.mockReturnValue(okAsync([{ id: "file-1" }]));
	providerFakes.sendDeliverablesEmail.mockReturnValue(okAsync(null));
	providerFakes.sendFeedbackEmail.mockResolvedValue(okAsync(null));
});

describe("deliverables email", () => {
	test("rejects a missing booking and missing Deliverables folder without sending", async () => {
		const missingBookingTest = createConvexTest();
		const missingBookingId = await seedThenDeleteBooking(missingBookingTest);
		const missingFolderTest = createConvexTest();
		const bookingId = await seedBooking(missingFolderTest);

		const missingResult = await missingBookingTest
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId: missingBookingId });
		const missingFolderResult = await missingFolderTest
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId });

		expect(missingResult).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(missingFolderResult).toEqual([{ reason: "DELIVERABLES_FOLDER_MISSING" }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("rejects an empty Deliverables folder without sending", async () => {
		const t = createConvexTest();
		const bookingId = await seedBookingWithDeliverablesFolder(t);
		providerFakes.listDriveFolderChildren.mockReturnValueOnce(okAsync([]));

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId });

		expect(result).toEqual([{ reason: "DELIVERABLES_FOLDER_EMPTY" }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("rejects a Drive listing failure without sending", async () => {
		const t = createConvexTest();
		const bookingId = await seedBookingWithDeliverablesFolder(t);
		providerFakes.listDriveFolderChildren.mockReturnValueOnce(
			errAsync({ reason: "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED" })
		);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId });

		expect(result).toEqual([{ reason: "DELIVERABLES_FOLDER_LIST_FAILED" }, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("sends the saved folder URL, detected customer type, and optional editor notes", async () => {
		const t = createConvexTest();
		await seedBooking(t, { editStatus: "completed" });
		const bookingId = await seedBookingWithDeliverablesFolder(t);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, {
				bookingId,
				editorNotes: "Final mix included"
			});

		expect(result).toEqual([null, null]);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendDeliverablesEmail).toHaveBeenCalledWith({
			date: "2020-01-10",
			driveLink: savedDeliverablesFolder.url,
			editorNotes: "Final mix included",
			email: "customer@example.com",
			emailVariant: "recurring",
			name: "Deliverables customer"
		});
		expect(providerFakes.ensureAnyoneReaderPermission).toHaveBeenCalledWith(
			{},
			savedDeliverablesFolder.id
		);
	});

	test("does not send again when the session is already completed", async () => {
		const t = createConvexTest();
		const bookingId = await seedBookingWithDeliverablesFolder(t, { editStatus: "completed" });

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId });

		expect(result).toEqual([null, null]);
		expect(providerFakes.sendDeliverablesEmail).not.toHaveBeenCalled();
	});

	test("returns the stable failure when the provider cannot send", async () => {
		const t = createConvexTest();
		const bookingId = await seedBookingWithDeliverablesFolder(t);
		providerFakes.sendDeliverablesEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

		const result = await t
			.withIdentity(adminIdentity)
			.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId });

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
	editStatus?: "completed";
	hiddenAt?: number;
	sessionStartAt?: number;
	status?: "confirmed" | "pending_payment";
};

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
			editStatus: options.editStatus,
			hiddenAt: options.hiddenAt
		})
	);
}

async function seedBookingWithDeliverablesFolder(t: TestClient, options: BookingOptions = {}) {
	const bookingId = await seedBooking(t, options);
	await t.run(async (ctx) => {
		const driveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "customer@example.com",
			displayName: "Deliverables account (VV Studios)",
			createdAt: now
		});
		await ctx.db.patch(bookingId, { driveClientId });
		await ctx.db.insert("driveSessions", {
			bookingId,
			driveClientId,
			deliverablesFolder: savedDeliverablesFolder,
			createdAt: now,
			updatedAt: now
		});
	});
	return bookingId;
}

async function seedThenDeleteBooking(t: TestClient): Promise<Id<"bookings">> {
	const bookingId = await seedBooking(t);
	await t.run((ctx) => ctx.db.delete(bookingId));
	return bookingId;
}
