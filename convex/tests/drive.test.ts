/**
 * These tests cover ordinary-session Google Drive workspace setup.
 *
 * 1. Client identity and folder names
 *    Emails normalize to a permanent client key, client names use the expected fallback,
 *    and session folder names use Australia/Sydney.
 *
 * 2. Confirmation scheduling
 *    Confirming an ordinary booking schedules workspace setup for the session end.
 *
 * 3. Scheduled setup
 *    An eligible booking creates and saves the client, session, Raw Media, Assets, and
 *    Deliverables folders in order.
 *
 * 4. Cancelled booking
 *    A cancelled booking skips scheduled setup without creating folders or recording failure.
 *
 * 5. Stale scheduled job
 *    A job with old timing skips setup without creating folders or recording failure.
 *
 * 6. Duplicate job and replay
 *    Repeating setup verifies saved folder IDs and does not create duplicate folders.
 *
 * 7. Partial setup retry
 *    A provider failure leaves saved progress, and the next run resumes at the missing folder.
 *
 * 8. Lost create response
 *    If Google creates a folder but loses the response, its private marker finds that folder
 *    and prevents a second folder from being created.
 *
 * 9. Failure status and retry
 *    An actionable provider failure is saved for the admin, and a successful retry clears it.
 *
 * 10. Failure classification
 *     Provider and persistence errors are actionable, while stale, cancelled, and package
 *     outcomes are expected skips.
 *
 * 11. Client folder permissions and assets email
 *     The client gets the required folder permissions without a Google invitation, one branded
 *     assets email, and targeted recovery after a permission failure.
 *
 * 12. Assets email retry
 *     A failed email is tracked separately from folder permissions and retry sends it once.
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
	normalizeDriveEmail
} from "#convex/lib/googleDrive";
import { createConvexTest } from "#convex/test.setup";

const emailFake = vi.hoisted(() => ({ sendClientAssetsEmail: vi.fn() }));

const driveFake = vi.hoisted(() => {
	type Folder = { id: string; name: string; webViewLink: string; marker: string; parentId: string };
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
			vi.fn<(request: CreateRequest) => Promise<{ data: Omit<Folder, "marker" | "parentId"> }>>(),
		list: vi.fn<(request: ListRequest) => Promise<{ data: { files: Folder[] } }>>(),
		get: vi.fn<(request: GetRequest) => Promise<{ data: Folder }>>(),
		update: vi.fn<() => Promise<{ data: { id: string } }>>(),
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
			files: {
				create: driveFake.create,
				list: driveFake.list,
				get: driveFake.get,
				update: driveFake.update
			},
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
			id,
			name,
			webViewLink: `https://drive.google.com/drive/folders/${id}`,
			marker,
			parentId
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
	driveFake.update.mockResolvedValue({ data: { id: "raw-media" } });
});

describe("Google Drive folder naming", () => {
	test("normalizes the permanent client key and formats folder names", () => {
		expect(normalizeDriveEmail("  Client@Example.COM ")).toBe("client@example.com");
		expect(getClientFolderName({ accountName: "Acme", contactName: "Alex" })).toBe(
			"Acme (VV Studios)"
		);
		expect(getClientFolderName({ accountName: " ", contactName: " Alex " })).toBe(
			"Alex (VV Studios)"
		);
		expect(getSessionFolderName(Date.parse("2026-08-13T00:00:00.000Z"))).toBe(
			"13 Aug 2026 — 10:00 AM"
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

	test("creates and saves every folder in order", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(driveFake.create.mock.calls.map(([request]) => request.requestBody?.name)).toEqual([
			"Test account (VV Studios)",
			"10 Jan 2030 — 11:00 AM",
			"Raw Media",
			"Assets",
			"Deliverables"
		]);
		expect(state.driveSession).toMatchObject({
			sessionFolder: { id: "folder-2" },
			rawMediaFolder: { id: "folder-3" },
			assetsFolder: { id: "folder-4" },
			deliverablesFolder: { id: "folder-5" }
		});
		expect(driveFake.update).toHaveBeenCalledTimes(1);
		expect(state.booking?.driveSetupFailureCode).toBeUndefined();
	});

	test("grants client folder permissions, isolates Raw Media, and sends one assets email", async () => {
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
			{ fileId: "folder-4", role: "writer", sendNotificationEmail: false },
			{ fileId: "folder-5", role: "commenter", sendNotificationEmail: false }
		]);
		expect(
			driveFake.permissionsCreate.mock.calls.some(([request]) => request.fileId === "folder-3")
		).toBe(false);
		expect(state.driveSession).toMatchObject({
			clientDrivePermissionsStatus: "ready",
			assetsEmailStatus: "sent"
		});
		expect(emailFake.sendClientAssetsEmail).toHaveBeenCalledWith({
			assetsUrl: "https://drive.google.com/drive/folders/folder-4",
			email: "customer@example.com",
			name: "Test customer"
		});
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
		driveFake.failCreateNameOnce = "Assets";

		await runSetup(t, bookingId);
		const failedState = await readDriveState(t, bookingId);
		expect(failedState.driveSession).toMatchObject({ rawMediaFolder: { id: "folder-3" } });
		expect(failedState.driveSession?.assetsFolder).toBeUndefined();
		expect(failedState.booking?.driveSetupFailureCode).toBe("GOOGLE_DRIVE_FOLDER_CREATE_FAILED");

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryDriveSetup, { bookingId });
		const recoveredState = await readDriveState(t, bookingId);
		expect(retryResult).toEqual([null, null]);
		expect(recoveredState.driveSession?.assetsFolder).toBeDefined();
		expect(recoveredState.driveSession?.deliverablesFolder).toBeDefined();
		expect(recoveredState.booking?.driveSetupFailureCode).toBeUndefined();
		expect(driveFake.create).toHaveBeenCalledTimes(6);
	});

	test("finds a created folder after its create response is lost", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		driveFake.loseCreateResponseNameOnce = "Assets";

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(state.driveSession?.assetsFolder).toMatchObject({ id: "folder-4" });
		expect(
			driveFake.create.mock.calls.filter(([request]) => request.requestBody?.name === "Assets")
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
	options: { status?: Doc<"bookings">["status"]; withReservation?: boolean } = {}
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "11:00",
			sessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: options.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			...(options.withReservation
				? {
						reservationCreatedAt: now,
						reservationSessionStartAt: sessionStartAt,
						reservationDuration: "1h"
					}
				: {})
		})
	);
}

async function readDriveState(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run(async (ctx) => ({
		booking: await ctx.db.get(bookingId),
		driveSession: await ctx.db
			.query("driveSessions")
			.withIndex("by_bookingId", (query) => query.eq("bookingId", bookingId))
			.unique()
	}));
}
