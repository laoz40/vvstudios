/**
 * Deliverables review email tests:
 *
 * 1. Editor marks session ready for review
 *    Schedules a host notification email job when an editor transitions into review.
 */
import type { UserIdentity } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { createConvexTest } from "#convex/test.setup";

type TestClient = ReturnType<typeof createConvexTest>;

type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "review" | "completed";
};

type UpdateSessionEditStatusResult = [{ reason: string } | null, null];

const updateSessionEditStatus = makeFunctionReference<
	"mutation",
	UpdateSessionEditStatusArgs,
	UpdateSessionEditStatusResult
>("sessions/admin:updateSessionEditStatus");

const now = Date.parse("2030-01-10T00:00:00.000Z");

const pastSessionStartAt = Date.parse("2029-12-01T10:00:00.000Z");

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
});

const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-one",
	subject: "editor-one",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

async function seedEditorProfile(t: TestClient): Promise<void> {
	await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: editorIdentity.tokenIdentifier,
			displayName: "Alex Editor",
			email: "alex@example.com",
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		});
	});
}

async function seedPastSession(t: TestClient): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Review Ready Customer",
				phone: "0400 000 000",
				accountName: "Review Ready Customer Pty Ltd",
				email: "review.ready@example.com",
				date: "2030-02-03",
				time: "10:30",
				sessionStartAt: pastSessionStartAt,
				duration: "1 hour",
				service: "Remote Podcast",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: Date.parse("2030-01-01T00:00:00.000Z"),
				editStatus: "editing",
				assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
				stripeSessionId: "stripe-review-ready",
				stripePaymentIntentId: "payment-review-ready"
			})
		)
	);
}

async function readScheduledJobs(t: TestClient) {
	return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

describe("deliverables review host email", () => {
	test("schedules host notification when editor marks session ready for review", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t);
		const bookingId = await seedPastSession(t);

		const [error] = await t
			.withIdentity(editorIdentity)
			.mutation(updateSessionEditStatus, { bookingId, editStatus: "review" });

		expect(error).toBeNull();

		const scheduledJobs = await readScheduledJobs(t);

		expect(scheduledJobs).toHaveLength(1);
		expect(scheduledJobs[0]).toMatchObject({
			name: "editor/deliverablesReviewEmail:sendDeliverablesReviewReadyEmail",
			state: { kind: "pending" }
		});
	});
});
