/**
 * Drive setup DB guards before Google Drive is called.
 *
 * 1. Client lookup
 *    Reuses clients by normalized email and rejects sync without a drive session row.
 *
 * 2. Session folder idempotency
 *    Repeated session folder saves keep the first folder id on the driveSessions row.
 *
 * 3. Email claim recovery
 *    Stale client and editor failures cannot replace newer successful sends or claim another send.
 */
import { describe, expect, test } from "vitest";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { getOrCreateDriveClientId } from "#convex/services/drive/driveInternal";
import { resolveSessionFolderDisplayName } from "#convex/lib/drive/sessionFolders/resolveFolderNames";
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

	test("rejects sync when the booking or drive session is missing", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const deletedBookingId = await t.run(async (ctx) => {
			const id = await ctx.db.insert(
				"bookings",
				bookingDocument({
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
				})
			);

			await ctx.db.delete("bookings", id);

			return id;
		});

		expect(
			await t.mutation(internal.sessionsDriveInternal.syncBookingDriveClientIdFromSession, {
				bookingId: deletedBookingId
			})
		).toEqual([{ reason: "BOOKING_NOT_FOUND" }, null]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.syncBookingDriveClientIdFromSession, {
				bookingId
			})
		).toEqual([{ reason: "DRIVE_RECORD_NOT_FOUND" }, null]);
	});

	test("allocates standalone client session numbers in date order", async () => {
		const t = createConvexTest();

		const driveClientId = await createDriveClient(t, {
			email: "repeat@example.com",
			displayName: "Repeat customer"
		});

		const earlierSessionStartAt = sessionStartAt;
		const laterSessionStartAt = sessionStartAt + 7 * 24 * 60 * 60 * 1000;

		const earlierBookingId = await seedStandaloneBooking(t, {
			driveClientId,
			sessionStartAt: earlierSessionStartAt,
			email: "repeat@example.com"
		});

		const laterBookingId = await seedStandaloneBooking(t, {
			driveClientId,
			sessionStartAt: laterSessionStartAt,
			email: "repeat@example.com"
		});

		expect(
			await t.mutation(internal.sessionsDriveInternal.allocateClientSessionNumber, {
				bookingId: laterBookingId
			})
		).toEqual([null, 2]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.allocateClientSessionNumber, {
				bookingId: earlierBookingId
			})
		).toEqual([null, 1]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.allocateClientSessionNumber, {
				bookingId: earlierBookingId
			})
		).toEqual([null, 1]);
	});

	test("shows a numbered standalone session folder name before drive setup runs", async () => {
		const t = createConvexTest();

		const driveClientId = await createDriveClient(t, {
			email: "preview@example.com",
			displayName: "Preview customer"
		});

		const bookingId = await seedStandaloneBooking(t, {
			driveClientId,
			sessionStartAt,
			email: "preview@example.com"
		});

		const sessionFolderName = await t.run(async (ctx) => {
			const booking = await ctx.db.get("bookings", bookingId);

			if (booking === null) throw new Error("Expected booking");

			return resolveSessionFolderDisplayName(ctx, booking, null);
		});

		expect(sessionFolderName).toBe("1 - 10 Jan 2030 (10:00AM)");
	});

	test("indexes standalone sessions linked by email when driveClientId is missing on the booking", async () => {
		const t = createConvexTest();

		const driveClientId = await createDriveClient(t, {
			email: "legacy@example.com",
			displayName: "Legacy customer"
		});

		await seedStandaloneBooking(t, { driveClientId, sessionStartAt, email: "legacy@example.com" });

		const laterBookingId = await seedStandaloneBooking(t, {
			sessionStartAt: sessionStartAt + 24 * 60 * 60 * 1000,
			email: "legacy@example.com",
			time: "11:00"
		});

		expect(
			await t.mutation(internal.sessionsDriveInternal.allocateClientSessionNumber, {
				bookingId: laterBookingId
			})
		).toEqual([null, 2]);
	});

	test("clears session folder fields and numbers after cancellation cleanup", async () => {
		const t = createConvexTest();

		const driveClientId = await createDriveClient(t, {
			email: "release@example.com",
			displayName: "Release customer"
		});

		const bookingId = await seedStandaloneBooking(t, {
			driveClientId,
			sessionStartAt,
			email: "release@example.com"
		});

		expect(
			await t.mutation(internal.sessionsDriveInternal.allocateClientSessionNumber, { bookingId })
		).toEqual([null, 1]);

		await t.mutation(internal.sessionsDriveInternal.saveDriveSessionFolder, {
			bookingId,
			driveClientId,
			folder: {
				id: "session-folder-release",
				name: "1 - 10 Jan 2030 (10:00AM)",
				webViewLink: "https://drive.example/session-release"
			}
		});

		expect(
			await t.mutation(internal.sessionsDriveInternal.clearSessionDriveDb, { bookingId })
		).toEqual([null, null]);

		const driveSession = await readDriveSession(t, bookingId);

		expect(driveSession?.clientSessionNumber).toBeUndefined();
		expect(driveSession?.sessionFolder).toBeUndefined();
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
			await t.mutation(internal.sessionsDriveInternal.saveDriveSessionFolder, {
				bookingId,
				driveClientId,
				folder: firstFolder
			})
		).toEqual([null, firstFolder.id]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.saveDriveSessionFolder, {
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

	test("stale client assets email failure keeps the newer sent result and blocks another claim", async () => {
		const t = createConvexTest();
		const { bookingId } = await seedAssetsEmailSetup(t);
		const firstClaimAt = now;
		const secondClaimAt = firstClaimAt + 15 * 60 * 1000 + 1;

		const [, firstClaim] = await t.mutation(internal.sessionsDriveInternal.claimClientAssetsEmail, {
			bookingId,
			attempt: "retry",
			now: firstClaimAt
		});

		if (firstClaim === null) throw new Error("Expected first email claim");

		const [, secondClaim] = await t.mutation(
			internal.sessionsDriveInternal.claimClientAssetsEmail,
			{ bookingId, attempt: "retry", now: secondClaimAt }
		);

		if (secondClaim === null) throw new Error("Expected replacement email claim");

		expect(
			await t.mutation(internal.sessionsDriveInternal.saveClientAssetsEmailResult, {
				bookingId,
				assetsFolderId: "assets-1",
				claimedAt: secondClaim.claimedAt,
				status: "sent"
			})
		).toEqual([null, null]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.saveClientAssetsEmailResult, {
				bookingId,
				assetsFolderId: "assets-1",
				claimedAt: firstClaim.claimedAt,
				status: "failed"
			})
		).toEqual([null, null]);

		const [error, status] = await t.query(internal.sessionsDriveInternal.getDriveSetup, {
			bookingId
		});

		expect(error).toBeNull();
		expect(status?.driveSession).toMatchObject({
			assetsEmailFolderId: "assets-1",
			assetsEmailStatus: "sent"
		});
		expect(status?.driveSession?.assetsEmailClaimedAt).toBeUndefined();
		expect(
			await t.mutation(internal.sessionsDriveInternal.claimClientAssetsEmail, {
				bookingId,
				attempt: "retry",
				now: secondClaimAt + 1
			})
		).toEqual([{ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" }, null]);
	});

	test("stale editor assignment email failure keeps the newer sent result and blocks another claim", async () => {
		const t = createConvexTest();
		const { bookingId, editorTokenIdentifier } = await seedEditorEmailSetup(t);
		const firstClaimAt = now;
		const secondClaimAt = firstClaimAt + 15 * 60 * 1000 + 1;

		const [, firstClaim] = await t.mutation(
			internal.sessionsDriveInternal.claimEditorAssignmentEmail,
			{ bookingId, editorTokenIdentifier, now: firstClaimAt }
		);

		if (firstClaim === null) throw new Error("Expected first editor email claim");

		const [, secondClaim] = await t.mutation(
			internal.sessionsDriveInternal.claimEditorAssignmentEmail,
			{ bookingId, editorTokenIdentifier, now: secondClaimAt }
		);

		if (secondClaim === null) throw new Error("Expected replacement editor email claim");

		expect(
			await t.mutation(internal.sessionsDriveInternal.saveEditorAssignmentEmailResult, {
				bookingId,
				claimedAt: secondClaim.claimedAt,
				editorTokenIdentifier,
				status: "sent"
			})
		).toEqual([null, null]);
		expect(
			await t.mutation(internal.sessionsDriveInternal.saveEditorAssignmentEmailResult, {
				bookingId,
				claimedAt: firstClaim.claimedAt,
				editorTokenIdentifier,
				status: "failed"
			})
		).toEqual([null, null]);

		const [error, status] = await t.query(internal.sessionsDriveInternal.getDriveSetup, {
			bookingId
		});

		expect(error).toBeNull();
		expect(status?.driveSession).toMatchObject({
			assignmentEmailStatus: "sent",
			assignmentEmailTokenIdentifier: editorTokenIdentifier
		});
		expect(status?.driveSession?.assignmentEmailClaimedAt).toBeUndefined();
		expect(
			await t.mutation(internal.sessionsDriveInternal.claimEditorAssignmentEmail, {
				bookingId,
				editorTokenIdentifier,
				now: secondClaimAt + 1
			})
		).toEqual([{ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" }, null]);
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
	return await seedStandaloneBooking(t, { email: "customer@example.com", sessionStartAt });
}

async function seedAssetsEmailSetup(t: TestClient) {
	return await t.run(async (ctx) => {
		const driveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "customer@example.com",
			displayName: "Test customer - Test account",
			assetsFolder: { id: "assets-1", url: "https://drive.example/assets-1" },
			createdAt: now
		});

		const bookingId = await ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Test customer",
				phone: "0400000000",
				accountName: "Test account",
				email: "customer@example.com",
				date: "2030-01-10",
				time: "10:00",
				sessionStartAt,
				duration: "1h",
				service: "Remote Podcast",
				addons: ["Complete Edit"],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: now,
				driveClientId
			})
		);

		await ctx.db.insert("driveSessions", {
			bookingId,
			driveClientId,
			clientDrivePermissionsStatus: "ready",
			createdAt: now,
			updatedAt: now
		});

		return { bookingId, driveClientId };
	});
}

async function seedEditorEmailSetup(t: TestClient) {
	const editorTokenIdentifier = "https://clerk.example|drive-editor";

	const bookingId = await t.run(async (ctx) => {
		const driveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "customer@example.com",
			displayName: "Test customer - Test account",
			createdAt: now
		});

		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: editorTokenIdentifier,
			displayName: "Drive Editor",
			email: "editor@example.com",
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		});

		const newBookingId = await ctx.db.insert(
			"bookings",
			bookingDocument({
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
				pendingPaymentCreatedAt: now,
				driveClientId,
				assignedEditorTokenIdentifier: editorTokenIdentifier
			})
		);

		await ctx.db.insert("driveSessions", {
			bookingId: newBookingId,
			driveClientId,
			editorDrivePermissionsStatus: "ready",
			editorDrivePermissionsTokenIdentifier: editorTokenIdentifier,
			createdAt: now,
			updatedAt: now
		});

		return newBookingId;
	});

	return { bookingId, editorTokenIdentifier };
}

async function seedStandaloneBooking(
	t: TestClient,
	args: { driveClientId?: Id<"driveClients">; email: string; sessionStartAt: number; time?: string }
) {
	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Test customer",
				phone: "0400000000",
				accountName: "Test account",
				email: args.email,
				date: "2030-01-10",
				time: args.time ?? "10:00",
				sessionStartAt: args.sessionStartAt,
				duration: "1h",
				service: "Remote Podcast",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: now,
				driveClientId: args.driveClientId
			})
		)
	);
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get("bookings", bookingId));
}

async function readDriveSession(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) =>
		ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	);
}
