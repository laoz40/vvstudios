/**
 * Drive setup DB guards before Google Drive is called.
 *
 * 1. Client lookup
 *    Reuses clients by normalized email and rejects backfill without a drive session row.
 *
 * 2. Session folder idempotency
 *    Repeated session folder saves keep the first folder id on the driveSessions row.
 */
import { describe, expect, test } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { getOrCreateDriveClientId } from "#convex/lib/driveFolders";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

describe("drive setup guards", () => {
	test("reuses one drive client row per normalized email", async () => {
		const t = createConvexTest();

		const firstClientId = await createDriveClient(t, {
			email: "  Customer@Gmail.com ",
			displayName: "Customer One"
		});

		const secondClientId = await createDriveClient(t, {
			email: "customer@gmail.com",
			displayName: "Customer Two"
		});

		expect(secondClientId).toEqual(firstClientId);

		const clients = await t.run((ctx) => ctx.db.query("driveClients").collect());

		expect(clients).toHaveLength(1);
		expect(clients[0]).toMatchObject({
			normalizedEmail: "customer@gmail.com",
			displayName: "Customer One"
		});
	});

	test("rejects backfill when the booking or drive session is missing", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const deletedBookingId = await t.run(async (ctx) => {
			const id = await ctx.db.insert("bookings", {
				name: "Deleted customer",
				phone: "0400000000",
				accountName: "Deleted account",
				email: "deleted@example.com",
				date: "2030-01-10",
				time: "10:00",
				sessionStartAt,
				duration: "1h",
				service: "Remote Podcast",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: now
			});

			await ctx.db.delete(id);

			return id;
		});

		expect(
			await t.mutation(internal.sessions.backfillBookingDriveClientId, {
				bookingId: deletedBookingId
			})
		).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(await t.mutation(internal.sessions.backfillBookingDriveClientId, { bookingId })).toEqual(
			[{ reason: "DRIVE_RECORD_NOT_FOUND" }, null]
		);
	});

	test("keeps the first saved session folder on repeated saves", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const driveClientId = await createDriveClient(t, {
			email: "customer@example.com",
			displayName: "Test customer"
		});

		const firstFolder = {
			id: "session-folder-1",
			name: "10 Jan 2030 - 10:00 AM",
			webViewLink: "https://drive.example/session-1"
		};

		const secondFolder = {
			id: "session-folder-2",
			name: "10 Jan 2030 - 10:00 AM",
			webViewLink: "https://drive.example/session-2"
		};

		expect(
			await t.mutation(internal.sessions.saveDriveSessionFolder, {
				bookingId,
				driveClientId,
				folder: firstFolder
			})
		).toEqual([null, firstFolder.id]);
		expect(
			await t.mutation(internal.sessions.saveDriveSessionFolder, {
				bookingId,
				driveClientId,
				folder: secondFolder
			})
		).toEqual([null, firstFolder.id]);

		const driveSession = await readDriveSession(t, bookingId);

		expect(driveSession).toMatchObject({
			sessionFolder: { id: firstFolder.id, url: firstFolder.webViewLink }
		});
		expect(await readBooking(t, bookingId)).toMatchObject({ driveClientId });
	});
});

async function createDriveClient(t: TestClient, client: { email: string; displayName: string }) {
	return await t.run(async (ctx) => {
		const result = await getOrCreateDriveClientId(ctx, client);

		if (result.isErr()) throw new Error("Expected drive client");

		return result.value;
	});
}

async function seedBooking(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			archived: false,
			pendingPaymentCreatedAt: now
		})
	);
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}

async function readDriveSession(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) =>
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	);
}
