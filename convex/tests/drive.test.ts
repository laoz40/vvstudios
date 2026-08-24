/**
 * These tests cover ordinary-session Google Drive workspace setup.
 *
 * 1. Client identity and folder names
 *    Normalizes client identity and formats Drive folder names.
 *
 * 2. Confirmation scheduling
 *    Schedules workspace setup for the session end.
 *
 * 3. Folder creation
 *    Creates one global assets library and dated session media folders.
 *
 * 4. Client access
 *    Adds the required permissions and sends one assets email.
 *
 * 5. Permission retry
 *    Retries failed permissions without recreating folders or resending email.
 *
 * 6. Assets email retry
 *    Tracks a failed email separately and sends it once on retry.
 *
 * 7. Cancelled booking
 *    Skips setup without recording a failure.
 *
 * 8. Stale scheduled job
 *    Skips setup when the booking timing has changed.
 *
 * 9. Client assets reuse
 *    Reuses one global assets library across sessions for the same client.
 *
 * 10. Setup replay
 *     Verifies saved folders without creating duplicates.
 *
 * 11. Partial setup retry
 *     Resumes from the first missing folder.
 *
 * 12. Lost create response
 *     Recovers the created folder through its private marker.
 *
 * 13. Setup failure retry
 *     Records a provider failure and clears it after retry.
 *
 * 14. Failure classification
 *     Records only actionable setup failures.
 *
 * Google Drive is replaced with an in-memory fake, so no real folders are created.
 */
import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { shouldRecordDriveSetupFailure } from "#convex/lib/driveSetup";
import {
	getClientFolderName,
	getSessionFolderName,
	getSessionMediaFolderName,
	normalizeDriveEmail
} from "#convex/lib/googleDrive";
import { createConvexTest } from "#convex/test.setup";

const emailFake = vi.hoisted(() => ({ sendClientAssetsEmail: vi.fn() }));

const driveFake = vi.hoisted(() => {
	type Folder = {
		id: string;
		name: string;
		webViewLink: string;
		marker: string;
		parentId: string;
		appProperties: { vvWorkspaceMarker: string };
		parents: string[];
	};
	type CreateRequest = {
		requestBody?: {
			appProperties?: { vvWorkspaceMarker?: string };
			name?: string;
			parents?: string[];
		};
	};
	type ListRequest = { q?: string };
	type GetRequest = { fileId: string };
	type Permission = {
		emailAddress?: string;
		fileId: string;
		id: string;
		role: "reader" | "writer" | "commenter" | "owner";
	};
	type PermissionCreateRequest = {
		fileId: string;
		requestBody?: { emailAddress?: string; role?: Permission["role"] };
		sendNotificationEmail?: boolean;
	};
	type PermissionListRequest = { fileId: string };
	return {
		folders: new Map<string, Folder>(),
		permissions: new Map<string, Permission>(),
		create:
			vi.fn<
				(request: CreateRequest) => Promise<{ data: Pick<Folder, "id" | "name" | "webViewLink"> }>
			>(),
		list: vi.fn<(request: ListRequest) => Promise<{ data: { files: Folder[] } }>>(),
		get: vi.fn<(request: GetRequest) => Promise<{ data: Folder }>>(),
		permissionsCreate: vi.fn<(request: PermissionCreateRequest) => Promise<{ data: Permission }>>(),
		permissionsList:
			vi.fn<(request: PermissionListRequest) => Promise<{ data: { permissions: Permission[] } }>>(),
		failCreateNameOnce: String(),
		failPermissionRoleOnce: String(),
		loseCreateResponseNameOnce: String()
	};
});

vi.mock("#convex/env", () => ({
	env: {
		GOOGLE_CLIENT_ID: "client-id",
		GOOGLE_CLIENT_SECRET: "client-secret",
		GOOGLE_REFRESH_TOKEN: "refresh-token",
		GOOGLE_DRIVE_ROOT_FOLDER_ID: "root-folder"
	}
}));

vi.mock("#convex/lib/googleAuth", () => ({ getGoogleOAuthClient: () => ({}) }));

vi.mock("#convex/lib/email", () => ({ sendClientAssetsEmail: emailFake.sendClientAssetsEmail }));

vi.mock("googleapis", () => ({
	google: {
		drive: () => ({
			files: { create: driveFake.create, list: driveFake.list, get: driveFake.get },
			permissions: { create: driveFake.permissionsCreate, list: driveFake.permissionsList }
		})
	}
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const sessionStartAt = Date.parse("2030-01-10T00:00:00.000Z");
const adminIdentity = {
	subject: "admin",
	issuer: "https://clerk.test",
	tokenIdentifier: "https://clerk.test|admin",
	publicMetadata: { role: "admin" }
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	driveFake.folders.clear();
	driveFake.permissions.clear();
	driveFake.failCreateNameOnce = "";
	driveFake.failPermissionRoleOnce = "";
	driveFake.loseCreateResponseNameOnce = "";
	emailFake.sendClientAssetsEmail.mockReturnValue(okAsync(null));

	driveFake.create.mockImplementation(async (request) => {
		const name = request.requestBody?.name ?? "";
		const marker = request.requestBody?.appProperties?.vvWorkspaceMarker ?? "";
		const parentId = request.requestBody?.parents?.[0] ?? "";
		if (driveFake.failCreateNameOnce === name) {
			driveFake.failCreateNameOnce = "";
			throw new Error("Drive create failed");
		}
		const id = `folder-${driveFake.folders.size + 1}`;
		const folder = {
			appProperties: { vvWorkspaceMarker: marker },
			id,
			name,
			webViewLink: `https://drive.google.com/drive/folders/${id}`,
			marker,
			parentId,
			parents: [parentId]
		};
		driveFake.folders.set(id, folder);
		if (driveFake.loseCreateResponseNameOnce === name) {
			driveFake.loseCreateResponseNameOnce = "";
			throw new Error("Drive response was lost");
		}
		return { data: { id: folder.id, name: folder.name, webViewLink: folder.webViewLink } };
	});
	driveFake.list.mockImplementation(async (request) => {
		const marker = request.q?.match(/value='([^']+)'/)?.[1] ?? "";
		const parentId = request.q?.match(/^'([^']+)' in parents/)?.[1] ?? "";
		const files = [...driveFake.folders.values()].filter(
			(folder) => folder.marker === marker && folder.parentId === parentId
		);
		return { data: { files } };
	});
	driveFake.get.mockImplementation(async ({ fileId }) => {
		const folder = driveFake.folders.get(fileId);
		if (folder === undefined) throw { code: 404 };
		return { data: folder };
	});
	driveFake.permissionsCreate.mockImplementation(async (request) => {
		const role = request.requestBody?.role ?? "reader";
		if (driveFake.failPermissionRoleOnce === role) {
			driveFake.failPermissionRoleOnce = "";
			throw new Error("Drive permission create failed");
		}
		const permission = {
			emailAddress: request.requestBody?.emailAddress ?? "",
			fileId: request.fileId,
			id: `permission-${driveFake.permissions.size + 1}`,
			role
		};
		driveFake.permissions.set(permission.id, permission);
		return { data: permission };
	});
	driveFake.permissionsList.mockImplementation(async ({ fileId }) => ({
		data: {
			permissions: [
				{ fileId, id: "owner-permission", role: "owner" as const },
				...Array.from(driveFake.permissions.values()).filter(
					(permission) => permission.fileId === fileId
				)
			]
		}
	}));
});

describe("Google Drive folder naming", () => {
	test("normalizes the permanent client key and formats session and media folder names", () => {
		expect(normalizeDriveEmail("  Client@Example.COM ")).toBe("client@example.com");
		expect(getClientFolderName({ accountName: "Acme", contactName: "Alex" })).toBe(
			"Acme (VV Studios)"
		);
		expect(getClientFolderName({ accountName: " ", contactName: " Alex " })).toBe(
			"Alex (VV Studios)"
		);
		expect(getSessionFolderName(Date.parse("2026-08-13T00:00:00.000Z"))).toBe(
			"13 Aug 2026 - 10:00 AM"
		);
		expect(getSessionMediaFolderName("Raw Media", Date.parse("2026-08-13T00:00:00.000Z"))).toBe(
			"Raw Media (13.8.26)"
		);
	});
});

describe("Google Drive scheduled workspace setup", () => {
	test("schedules setup for the confirmed session end", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, { status: "pending_payment", withReservation: true });

		const result = await t.mutation(internal.bookingConfirmation.markBookingConfirmed, {
			bookingId,
			reservation: { reservedAt: now, sessionStartAt, duration: "1h" }
		});
		const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());

		expect(result).toEqual([null, null]);
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			args: [{ bookingId, sessionStartAt, duration: "1h" }],
			scheduledTime: sessionStartAt + 60 * 60 * 1000
		});
	});

	test("creates the client library and dated ordinary session folders", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(driveFake.create.mock.calls.map(([request]) => request.requestBody?.name)).toEqual([
			"Test account (VV Studios)",
			"_Assets",
			"10 Jan 2030 - 11:00 AM",
			"Raw Media (10.1.30)",
			"Deliverables (10.1.30)"
		]);
		expect(state.driveClient).toMatchObject({ assetsFolder: { id: "folder-2" } });
		expect(state.driveSession).toMatchObject({
			sessionFolder: { id: "folder-3" },
			rawMediaFolder: { id: "folder-4" },
			deliverablesFolder: { id: "folder-5" }
		});
		expect(state.booking?.driveSetupFailureCode).toBeUndefined();
	});

	test("grants client writer access to global assets and emails its reusable link", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(
			driveFake.permissionsCreate.mock.calls.map(([request]) => ({
				fileId: request.fileId,
				role: request.requestBody?.role,
				sendNotificationEmail: request.sendNotificationEmail
			}))
		).toEqual([
			{ fileId: "folder-1", role: "reader", sendNotificationEmail: false },
			{ fileId: "folder-2", role: "writer", sendNotificationEmail: false }
		]);
		expect(
			driveFake.permissionsCreate.mock.calls.some(
				([request]) => request.fileId === "folder-3" || request.fileId === "folder-5"
			)
		).toBe(false);
		expect(state.driveSession).toMatchObject({
			clientDrivePermissionsStatus: "ready",
			assetsEmailStatus: "sent"
		});
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledWith({
			assetsUrl: "https://drive.google.com/drive/folders/folder-2",
			email: "customer@example.com",
			name: "Test customer"
		});
	});

	test("reuses one global assets library across sessions for the same client", async () => {
		const t = createConvexTest();
		const firstBookingId = await seedBooking(t);
		const secondStartAt = sessionStartAt + 24 * 60 * 60 * 1000;
		const secondBookingId = await seedBooking(t, { sessionStartAt: secondStartAt });

		await runSetup(t, firstBookingId);
		await runSetup(t, secondBookingId, secondStartAt);

		const assetsFolders = [...driveFake.folders.values()].filter(
			(folder) => folder.name === "_Assets"
		);
		expect(assetsFolders).toHaveLength(1);
		expect(driveFake.create).toHaveBeenCalledTimes(8);
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledTimes(2);
		expect(emailFake.sendClientAssetsEmail).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ assetsUrl: assetsFolders[0]?.webViewLink })
		);
		expect(emailFake.sendClientAssetsEmail).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ assetsUrl: assetsFolders[0]?.webViewLink })
		);
	});

	test("retries failed client permissions without recreating folders or resending the email", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		driveFake.failPermissionRoleOnce = "writer";

		await runSetup(t, bookingId);
		const failedState = await readDriveState(t, bookingId);
		expect(failedState.driveSession?.deliverablesFolder).toBeDefined();
		expect(failedState.driveSession).toMatchObject({ clientDrivePermissionsStatus: "failed" });
		expect(emailFake.sendClientAssetsEmail).not.toHaveBeenCalled();

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryClientDrivePermissions, { bookingId });
		const recoveredState = await readDriveState(t, bookingId);
		expect(retryResult).toEqual([null, null]);
		expect(recoveredState.driveSession).toMatchObject({
			assetsEmailStatus: "sent",
			clientDrivePermissionsStatus: "ready"
		});
		expect(driveFake.create).toHaveBeenCalledTimes(5);
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledTimes(1);

		await runSetup(t, bookingId);
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledTimes(1);
	});

	test("tracks a failed assets email separately and retries it once", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		emailFake.sendClientAssetsEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

		await runSetup(t, bookingId);
		const failedState = await readDriveState(t, bookingId);
		expect(failedState.driveSession).toMatchObject({ assetsEmailStatus: "failed" });

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryClientDrivePermissions, { bookingId });
		const recoveredState = await readDriveState(t, bookingId);
		expect(retryResult).toEqual([null, null]);
		expect(recoveredState.driveSession).toMatchObject({ assetsEmailStatus: "sent" });
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledTimes(2);
	});

	test("skips a cancelled booking without recording a setup failure", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, { status: "cancelled" });

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(driveFake.create).not.toHaveBeenCalled();
		expect(state.driveSession).toBeNull();
		expect(state.booking?.driveSetupFailureCode).toBeUndefined();
	});

	test("skips a stale job without recording a setup failure", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId, sessionStartAt - 60_000);
		const state = await readDriveState(t, bookingId);

		expect(driveFake.create).not.toHaveBeenCalled();
		expect(state.driveSession).toBeNull();
		expect(state.booking?.driveSetupFailureCode).toBeUndefined();
	});

	test("replays setup from saved folder IDs without creating duplicates", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId);
		await runSetup(t, bookingId);

		expect(driveFake.create).toHaveBeenCalledTimes(5);
		expect(driveFake.get).toHaveBeenCalledTimes(5);
		expect(driveFake.folders).toHaveLength(5);
	});

	test("resumes after a partial provider failure", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		driveFake.failCreateNameOnce = "_Assets";

		await runSetup(t, bookingId);
		const failedState = await readDriveState(t, bookingId);
		expect(failedState.driveSession).toBeNull();
		expect(failedState.driveClient?.assetsFolder).toBeUndefined();
		expect(failedState.booking?.driveSetupFailureCode).toBe("GOOGLE_DRIVE_FOLDER_CREATE_FAILED");

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryDriveSetup, { bookingId });
		const recoveredState = await readDriveState(t, bookingId);
		expect(retryResult).toEqual([null, null]);
		expect(recoveredState.driveClient?.assetsFolder).toBeDefined();
		expect(recoveredState.driveSession?.deliverablesFolder).toBeDefined();
		expect(recoveredState.booking?.driveSetupFailureCode).toBeUndefined();
		expect(driveFake.create).toHaveBeenCalledTimes(6);
	});

	test("finds a created folder after its create response is lost", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		driveFake.loseCreateResponseNameOnce = "_Assets";

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(state.driveClient?.assetsFolder).toMatchObject({ id: "folder-2" });
		expect(
			driveFake.create.mock.calls.filter(([request]) => request.requestBody?.name === "_Assets")
		).toHaveLength(1);
		expect(state.booking?.driveSetupFailureCode).toBeUndefined();
	});

	test("records a provider failure and clears it after retry", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		driveFake.failCreateNameOnce = "Test account (VV Studios)";

		await runSetup(t, bookingId);
		expect((await readDriveState(t, bookingId)).booking).toMatchObject({
			driveSetupFailureCode: "GOOGLE_DRIVE_FOLDER_CREATE_FAILED",
			driveSetupFailedAt: now
		});

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryDriveSetup, { bookingId });
		expect(retryResult).toEqual([null, null]);
		expect((await readDriveState(t, bookingId)).booking?.driveSetupFailureCode).toBeUndefined();
	});
});

describe("Google Drive setup failure classification", () => {
	test("records only actionable Drive setup failures", () => {
		expect(shouldRecordDriveSetupFailure({ reason: "GOOGLE_DRIVE_FOLDER_CREATE_FAILED" })).toBe(
			true
		);
		expect(shouldRecordDriveSetupFailure({ reason: "GOOGLE_DRIVE_FOLDER_MISSING" })).toBe(true);
		expect(shouldRecordDriveSetupFailure({ reason: "BOOKING_NOT_ELIGIBLE" })).toBe(false);
		expect(shouldRecordDriveSetupFailure({ reason: "BOOKING_TIMING_CHANGED" })).toBe(false);
		expect(shouldRecordDriveSetupFailure({ reason: "PACKAGE_SESSION_NOT_SUPPORTED" })).toBe(false);
	});
});

async function runSetup(
	t: TestClient,
	bookingId: Id<"bookings">,
	expectedStartAt = sessionStartAt
) {
	return await t.action(internal.googleCalendar.runScheduledDriveSetup, {
		bookingId,
		sessionStartAt: expectedStartAt,
		duration: "1h"
	});
}

async function seedBooking(
	t: TestClient,
	options: {
		status?: Doc<"bookings">["status"];
		withReservation?: boolean;
		sessionStartAt?: number;
	} = {}
) {
	const bookingStartAt = options.sessionStartAt ?? sessionStartAt;
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "11:00",
			sessionStartAt: bookingStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: options.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			...(options.withReservation
				? {
						reservationCreatedAt: now,
						reservationSessionStartAt: bookingStartAt,
						reservationDuration: "1h"
					}
				: {})
		})
	);
}

async function readDriveState(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run(async (ctx) => {
		const booking = await ctx.db.get(bookingId);
		const driveClient =
			booking === null
				? null
				: await ctx.db
						.query("driveClients")
						.withIndex("by_normalizedEmail", (query) =>
							query.eq("normalizedEmail", normalizeDriveEmail(booking.email))
						)
						.unique();
		const driveSession = await ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique();

		return { booking, driveClient, driveSession };
	});
}
