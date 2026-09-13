/**
 * These tests cover reschedule link eligibility and cleanup.
 *
 * 1. Link and booking eligibility
 *    Unknown, used, expired, past-session, and unsupported booking links must be rejected,
 *    while links for every supported booking state remain accessible.
 *
 * 2. Missing locked link cleanup
 *    Unlocking a deleted link must report that it is missing rather than already used.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const originalSessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
});

describe("customer booking rescheduling", () => {
	test("rejects invalid links and bookings while accepting supported booking states", async () => {
		const rejectedCases = [
			{ kind: "unknown", expectedReason: "RESCHEDULE_LINK_NOT_FOUND" },
			{ kind: "used", expectedReason: "RESCHEDULE_LINK_USED" },
			{ kind: "expired", expectedReason: "RESCHEDULE_LINK_EXPIRED" },
			{ kind: "past-session", expectedReason: "RESCHEDULE_LINK_EXPIRED" },
			{ kind: "unsupported-status", expectedReason: "BOOKING_NOT_RESCHEDULABLE" }
		] as const;

		await Promise.all(
			rejectedCases.map(async (testCase) => {
				const t = createConvexTest();
				const seeded = await seedReschedulableSession(t);
				let token = seeded.token;

				if (testCase.kind === "unknown") {
					token = "unknown-reschedule-token";
				} else {
					await t.run(async (ctx) => {
						if (testCase.kind === "used") {
							await ctx.db.patch(seeded.linkId, { status: "used", usedAt: now });
						}

						if (testCase.kind === "expired") {
							await ctx.db.patch(seeded.linkId, { status: "expired" });
						}

						if (testCase.kind === "past-session") {
							await ctx.db.patch(seeded.bookingId, { sessionStartAt: now - 1 });
						}

						if (testCase.kind === "unsupported-status") {
							await ctx.db.patch(seeded.bookingId, { status: "cancelled" });
						}
					});
				}

				const result = await t.query(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
					token,
					now
				});

				expect(result).toEqual([{ reason: testCase.expectedReason }, null]);
			})
		);

		const supportedCases = [
			{ status: "confirmed" as const },
			{ status: "email_failed" as const },
			{ status: "failed" as const, bookingFailureCode: "BOOKING_TIME_UNAVAILABLE" as const },
			{ status: "failed" as const, bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED" as const }
		];

		await Promise.all(
			supportedCases.map(async (bookingState) => {
				const t = createConvexTest();
				const seeded = await seedReschedulableSession(t);
				await t.run((ctx) => ctx.db.patch(seeded.bookingId, bookingState));

				const result = await t.query(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
					token: seeded.token,
					now
				});

				expect(result[0]).toBeNull();
				expect(result[1]?.session._id).toBe(seeded.bookingId);
			})
		);
	});

	// Verifies a missing cleanup target remains distinct from a stale or competing lock.
	test("reports a deleted locked link as not found during cleanup", async () => {
		const t = createConvexTest();
		const { linkId } = await seedReschedulableSession(t);

		await t.run((ctx) => ctx.db.delete(linkId));

		const result = await t.mutation(internal.sessionReschedule.unlockRescheduleLink, {
			linkId,
			lockedAt: now
		});

		expect(result).toEqual([{ reason: "RESCHEDULE_LINK_NOT_FOUND" }, null]);
	});
});

async function seedReschedulableSession(t: TestClient) {
	const bookingId = await t.run(async (ctx) => {
		await ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 30,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		});

		return await ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: originalSessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now,
			googleCalendarId: "primary-calendar",
			googleEventId: "original-event",
			reminderEmailClaimedAt: now - 3,
			reminderEmailSentAt: now - 2,
			reminderEmailFailureCode: "SEND_FAILED"
		});
	});

	const linkResult = await t.mutation(internal.sessionReschedule.createActiveRescheduleLink, {
		bookingId,
		expiresAt: originalSessionStartAt,
		now
	});

	if (linkResult[0] !== null) throw new Error("Failed to seed reschedule link");

	return { bookingId, linkId: linkResult[1].linkId, token: linkResult[1].token };
}
