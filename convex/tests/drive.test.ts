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
 * 15. Editor assignment before setup
 *     Finishes pending editor permissions after folders exist and sends one branded email.
 *
 * 16. Editor assignment after setup
 *     Sets up a later assignment without Google notification emails.
 *
 * 17. Shared editor assets access
 *     Reuses one client assets permission across the editor's sessions.
 *
 * 18. Failed editor email replay
 *     Retries a failed assignment email when editor access setup runs again.
 *
 * 19. Editor access recovery
 *     Tracks provider and email failures separately and protects their retry actions.
 *
 * 20. Reassignment cleanup and email failure
 *     Removes the former editor, grants the replacement access, and keeps the removal when the assignment email fails.
 *
 * 21. Shared assets access during unassignment
 *     Keeps assets access after one unassignment and removes it after the editor's final client assignment.
 *
 * 22. Failed removal recording
 *     Records a failed removal and still grants the replacement editor access.
 *
 * 23. Previous editor removal retry
 *     Retries a failed removal by re-finding the editor's permissions and protects the action.
 *
 * 24. Client record without folder
 *     Patches the created client folder into the record created at booking time.
 *
 * 25. Package session during unassignment
 *     Keeps shared assets access while a package session of the same client keeps the editor.
 *
 * 26. Package workspace creation
 *     Creates the package folder, numbered session folder, and dated media folders.
 *
 * 27. Package scheduling
 *     Schedules workspace setup when a package session is confirmed.
 *
 * 28. Package session numbers out of order
 *     Numbers sessions by scheduled date order even when booked out of order.
 *
 * 29. Package numbers for future sessions
 *     Reserves date-order positions for scheduled future sessions.
 *
 * 30. Package number retry preservation
 *     Keeps the allocated number across setup retries.
 *
 * 31. Package cancellation gaps
 *     Keeps cancelled session numbers reserved so replacements never reuse them.
 *
 * 32. Concurrent package setup
 *     Allocates distinct numbers when sessions are set up concurrently.
 *
 * 33. Package folder reuse
 *     Reuses one package folder and the client assets library across sessions.
 *
 * 34. Package editor access
 *     Grants the assigned editor access and sends the branded email for a package session.
 *
 * 35. Package folder status
 *     Reports the package folder and numbered session label in the status query.
 *
 * 36. Package folder sibling status
 *     Shows a sibling session's package folder before this session is set up.
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

const emailFake = vi.hoisted(() => ({
	sendClientAssetsEmail: vi.fn(),
	sendEditorAssignmentEmail: vi.fn()
}));

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
	type PermissionDeleteRequest = { fileId: string; permissionId: string };
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
		permissionsDelete: vi.fn<(request: PermissionDeleteRequest) => Promise<{ data: object }>>(),
		permissionsList:
			vi.fn<(request: PermissionListRequest) => Promise<{ data: { permissions: Permission[] } }>>(),
		failCreateNameOnce: String(),
		failPermissionRoleOnce: String(),
		loseCreateResponseNameOnce: String(),
		failNextDelete: false
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

vi.mock("#convex/lib/email", () => ({
	sendClientAssetsEmail: emailFake.sendClientAssetsEmail,
	sendEditorAssignmentEmail: emailFake.sendEditorAssignmentEmail
}));

vi.mock("googleapis", () => ({
	google: {
		drive: () => ({
			files: { create: driveFake.create, list: driveFake.list, get: driveFake.get },
			permissions: {
				create: driveFake.permissionsCreate,
				delete: driveFake.permissionsDelete,
				list: driveFake.permissionsList
			}
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
const editorIdentity = {
	subject: "editor",
	issuer: "https://clerk.test",
	tokenIdentifier: "https://clerk.test|editor",
	publicMetadata: { role: "editor" }
};
const otherEditorIdentity = {
	subject: "other-editor",
	issuer: "https://clerk.test",
	tokenIdentifier: "https://clerk.test|other-editor",
	publicMetadata: { role: "editor" }
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
	driveFake.failNextDelete = false;
	emailFake.sendClientAssetsEmail.mockReturnValue(okAsync(null));
	emailFake.sendEditorAssignmentEmail.mockReturnValue(okAsync(null));

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
	driveFake.permissionsDelete.mockImplementation(async ({ permissionId }) => {
		if (driveFake.failNextDelete) {
			driveFake.failNextDelete = false;
			throw new Error("Drive permission delete failed");
		}
		driveFake.permissions.delete(permissionId);
		return { data: {} };
	});
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

	test("patches the client folder into the record created at booking time", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		await runSetup(t, bookingId);
		const clientRows = await t.run((ctx) => ctx.db.query("driveClients").collect());

		expect(clientRows).toHaveLength(1);
		expect(clientRows[0]).toMatchObject({
			normalizedEmail: "customer@example.com",
			folderId: "folder-1",
			folderUrl: "https://drive.google.com/drive/folders/folder-1"
		});
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

describe("Google Drive editor access setup", () => {
	test("finishes an assignment made before folder setup and sends one branded email", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		await runSetup(t, bookingId);
		await runEditorAccessSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(state.driveSession).toMatchObject({
			editorDrivePermissionsStatus: "ready",
			editorDrivePermissionsTokenIdentifier: editorIdentity.tokenIdentifier,
			assignmentEmailStatus: "sent",
			assignmentEmailTokenIdentifier: editorIdentity.tokenIdentifier
		});
		expect(
			driveFake.permissionsCreate.mock.calls
				.filter(([request]) => request.requestBody?.emailAddress === "editor@example.com")
				.map(([request]) => ({
					fileId: request.fileId,
					role: request.requestBody?.role,
					sendNotificationEmail: request.sendNotificationEmail
				}))
		).toEqual([
			{ fileId: "folder-3", role: "reader", sendNotificationEmail: false },
			{ fileId: "folder-2", role: "reader", sendNotificationEmail: false },
			{ fileId: "folder-5", role: "writer", sendNotificationEmail: false }
		]);
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledWith({
			editorEmail: "editor@example.com",
			editorName: "Test editor",
			sessionName: "Test account",
			sessionStartAt
		});

		await runEditorAccessSetup(t, bookingId);
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledTimes(1);
	});

	test("sets up access for an assignment made after folders exist", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const bookingId = await seedBooking(t);
		await runSetup(t, bookingId);

		const assignmentResult = await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId,
				editorTokenIdentifier: editorIdentity.tokenIdentifier
			});
		const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		await runEditorAccessSetup(t, bookingId);

		expect(assignmentResult).toEqual([null, null]);
		expect(jobs).toHaveLength(1);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			editorDrivePermissionsStatus: "ready",
			assignmentEmailStatus: "sent"
		});
	});

	test("reuses one assets permission for the same client and editor", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const firstBookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		const secondStartAt = sessionStartAt + 24 * 60 * 60 * 1000;
		const secondBookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
			sessionStartAt: secondStartAt
		});

		await runSetup(t, firstBookingId);
		await runSetup(t, secondBookingId, secondStartAt);

		const assetsPermissionCreates = driveFake.permissionsCreate.mock.calls.filter(
			([request]) =>
				request.fileId === "folder-2" && request.requestBody?.emailAddress === "editor@example.com"
		);
		const savedPermissions = await t.run((ctx) =>
			ctx.db.query("driveClientEditorPermissions").take(2)
		);
		expect(assetsPermissionCreates).toHaveLength(1);
		expect(savedPermissions).toHaveLength(1);
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledTimes(2);
	});

	test("revokes the former editor before granting a replacement editor access", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		await seedEditor(t, otherEditorIdentity, "other-editor@example.com", "Other editor");
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		await runSetup(t, bookingId);
		emailFake.sendEditorAssignmentEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);
		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId,
				editorTokenIdentifier: otherEditorIdentity.tokenIdentifier
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "editor@example.com"
			)
		).toHaveLength(0);
		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "other-editor@example.com"
			)
		).toHaveLength(3);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			assignmentEmailStatus: "failed",
			editorDrivePermissionsTokenIdentifier: otherEditorIdentity.tokenIdentifier
		});
	});

	test("keeps shared assets access until the editor's final client assignment is removed", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const firstBookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		const secondStartAt = sessionStartAt + 24 * 60 * 60 * 1000;
		const secondBookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
			sessionStartAt: secondStartAt
		});
		await runSetup(t, firstBookingId);
		await runSetup(t, secondBookingId, secondStartAt);
		const assetsPermission = [...driveFake.permissions.values()].find(
			(permission) =>
				permission.fileId === "folder-2" && permission.emailAddress === "editor@example.com"
		);
		expect(assetsPermission).toBeDefined();
		if (assetsPermission === undefined) throw new Error("Expected saved assets permission");

		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId: firstBookingId,
				editorTokenIdentifier: null
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId: firstBookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		expect(driveFake.permissions.has(assetsPermission.id)).toBe(true);

		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId: secondBookingId,
				editorTokenIdentifier: null
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId: secondBookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		expect(driveFake.permissions.has(assetsPermission.id)).toBe(false);
		expect(await t.run((ctx) => ctx.db.query("driveClientEditorPermissions").take(1))).toHaveLength(
			0
		);
	});

	test("keeps shared assets access while a package session of the same client keeps the editor", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		const packageId = await seedPackage(t);
		await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
			multiBookingPackageId: packageId,
			sessionStartAt: sessionStartAt + 24 * 60 * 60 * 1000
		});
		await runSetup(t, bookingId);
		const assetsPermission = [...driveFake.permissions.values()].find(
			(permission) =>
				permission.fileId === "folder-2" && permission.emailAddress === "editor@example.com"
		);
		expect(assetsPermission).toBeDefined();
		if (assetsPermission === undefined) throw new Error("Expected saved assets permission");

		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId,
				editorTokenIdentifier: null
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		// The editor's package session for the same client still preserves assets access.
		expect(driveFake.permissions.has(assetsPermission.id)).toBe(true);
	});

	test("retries a failed assignment email when editor access setup runs again", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		emailFake.sendEditorAssignmentEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

		await runSetup(t, bookingId);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			assignmentEmailStatus: "failed"
		});

		expect(await runEditorAccessSetup(t, bookingId)).toEqual([null, null]);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			assignmentEmailStatus: "sent"
		});
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledTimes(2);
	});

	test("tracks an assignment email failure separately and protects its retry", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		emailFake.sendEditorAssignmentEmail.mockReturnValueOnce(
			errAsync({ reason: "EMAIL_REQUEST_FAILED" })
		);

		await runSetup(t, bookingId);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			editorDrivePermissionsStatus: "ready",
			assignmentEmailStatus: "failed"
		});
		expect(await t.action(api.drive.retryEditorAssignmentEmail, { bookingId })).toEqual([
			{ reason: "NOT_AUTHENTICATED" },
			null
		]);

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.drive.retryEditorAssignmentEmail, { bookingId });
		expect(retryResult).toEqual([null, null]);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			assignmentEmailStatus: "sent"
		});
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledTimes(2);
	});

	test("records a failed removal and still grants the replacement editor access", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		await seedEditor(t, otherEditorIdentity, "other-editor@example.com", "Other editor");
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		await runSetup(t, bookingId);
		driveFake.failNextDelete = true;
		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId,
				editorTokenIdentifier: otherEditorIdentity.tokenIdentifier
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		// The old editor keeps Drive access and the failed removal is saved for a manual retry.
		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "editor@example.com"
			)
		).toHaveLength(3);
		const driveSession = (await readDriveState(t, bookingId)).driveSession;
		expect(driveSession).toMatchObject({
			failedRemovalEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		// The replacement editor's access setup was not blocked by the removal failure.
		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "other-editor@example.com"
			)
		).toHaveLength(3);
		expect(driveSession).toMatchObject({
			editorDrivePermissionsTokenIdentifier: otherEditorIdentity.tokenIdentifier
		});
	});

	test("retries a failed removal by re-finding the editor's permissions and protects the action", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		await seedEditor(t, otherEditorIdentity, "other-editor@example.com", "Other editor");
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
		await runSetup(t, bookingId);
		driveFake.failNextDelete = true;
		await t
			.withIdentity(adminIdentity)
			.mutation(api.sessions.assignSessionEditor, {
				adminNotes: "",
				bookingId,
				editorTokenIdentifier: otherEditorIdentity.tokenIdentifier
			});
		await t.action(internal.drive.updateEditorDriveAccess, {
			bookingId,
			previousEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(await t.action(api.drive.retryPreviousEditorRemoval, { bookingId })).toEqual([
			{ reason: "NOT_AUTHENTICATED" },
			null
		]);

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.drive.retryPreviousEditorRemoval, { bookingId });
		expect(retryResult).toEqual([null, null]);
		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "editor@example.com"
			)
		).toHaveLength(0);
		// The failed removal marker is cleared and the replacement editor's permissions are untouched.
		expect(
			(await readDriveState(t, bookingId)).driveSession?.failedRemovalEditorTokenIdentifier
		).toBeUndefined();
		expect(
			[...driveFake.permissions.values()].filter(
				(permission) => permission.emailAddress === "other-editor@example.com"
			)
		).toHaveLength(3);
		expect(
			await t.run((ctx) => ctx.db.query("driveClientEditorPermissions").collect())
		).toHaveLength(1);
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
	});
});

describe("Google Drive package workspaces", () => {
	const packageFolderName = "4-Session Package - Ordered on 01 Jan 2030";
	const sessionFolderName = "Session 01 - 10 Jan 2030 - 11:00 AM";

	test("creates the package folder, numbered session folder, and dated media folders", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const bookingId = await seedBooking(t, { multiBookingPackageId: packageId });

		await runSetup(t, bookingId);
		const state = await readDriveState(t, bookingId);

		expect(driveFake.create.mock.calls.map(([request]) => request.requestBody?.name)).toEqual([
			"Test account (VV Studios)",
			"_Assets",
			packageFolderName,
			sessionFolderName,
			"Raw Media (10.1.30)",
			"Deliverables (10.1.30)"
		]);
		const packageFolder = [...driveFake.folders.values()].find(
			(folder) => folder.name === packageFolderName
		);
		const sessionFolder = [...driveFake.folders.values()].find(
			(folder) => folder.name === sessionFolderName
		);
		// The session workspace lives inside the package folder, not the client folder.
		expect(sessionFolder?.parentId).toBe(packageFolder?.id);
		expect(state.driveSession).toMatchObject({
			packageSessionNumber: 1,
			packageFolder: { id: packageFolder?.id },
			sessionFolder: { id: sessionFolder?.id },
			rawMediaFolder: { id: "folder-5" },
			deliverablesFolder: { id: "folder-6" },
			clientDrivePermissionsStatus: "ready",
			assetsEmailStatus: "sent"
		});
	});

	test("schedules workspace setup when a package session is confirmed", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const bookingId = await seedBooking(t, {
			status: "pending_payment",
			withReservation: true,
			multiBookingPackageId: packageId
		});

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

	test("numbers sessions by scheduled date order even when booked out of order", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const laterStartAt = sessionStartAt + 7 * 24 * 60 * 60 * 1000;
		const laterBookingId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: laterStartAt
		});

		await runSetup(t, laterBookingId, laterStartAt);
		expect((await readDriveState(t, laterBookingId)).driveSession).toMatchObject({
			packageSessionNumber: 1
		});

		// The earlier session was booked after the later one had already created its folder,
		// so its date-order position is taken and it receives the next free number.
		const earlierBookingId = await seedBooking(t, { multiBookingPackageId: packageId });
		await runSetup(t, earlierBookingId);
		expect((await readDriveState(t, earlierBookingId)).driveSession).toMatchObject({
			packageSessionNumber: 2
		});
		expect(
			driveFake.create.mock.calls.some(
				([request]) => request.requestBody?.name === "Session 02 - 10 Jan 2030 - 11:00 AM"
			)
		).toBe(true);
	});

	test("reserves date-order positions for scheduled future sessions", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const futureStartAt = sessionStartAt + 30 * 24 * 60 * 60 * 1000;
		const bookingId = await seedBooking(t, { multiBookingPackageId: packageId });
		const futureBookingId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: futureStartAt
		});

		// The future session is scheduled, so it keeps position 1 even before its own setup.
		await runSetup(t, futureBookingId, futureStartAt);
		expect((await readDriveState(t, futureBookingId)).driveSession).toMatchObject({
			packageSessionNumber: 2
		});

		await runSetup(t, bookingId);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			packageSessionNumber: 1
		});
	});

	test("keeps the allocated number across setup retries", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const bookingId = await seedBooking(t, { multiBookingPackageId: packageId });
		driveFake.failCreateNameOnce = sessionFolderName;

		await runSetup(t, bookingId);
		const failedState = await readDriveState(t, bookingId);
		expect(failedState.driveSession).toMatchObject({ packageSessionNumber: 1 });
		expect(failedState.driveSession?.sessionFolder).toBeUndefined();
		expect(failedState.booking?.driveSetupFailureCode).toBe("GOOGLE_DRIVE_FOLDER_CREATE_FAILED");

		const retryResult = await t
			.withIdentity(adminIdentity)
			.action(api.googleCalendar.retryDriveSetup, { bookingId });
		expect(retryResult).toEqual([null, null]);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			packageSessionNumber: 1,
			// The retry creates only the session folder, after the verified earlier folders.
			sessionFolder: { id: "folder-4" }
		});
		// Only one numbered session folder was ever created.
		expect(
			[...driveFake.folders.values()].filter((folder) => folder.name.startsWith("Session "))
		).toHaveLength(1);
	});

	test("keeps cancelled session numbers reserved so replacements never reuse them", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const dayMs = 24 * 60 * 60 * 1000;
		const firstId = await seedBooking(t, { multiBookingPackageId: packageId });
		const secondStartAt = sessionStartAt + dayMs;
		const secondId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: secondStartAt
		});
		const thirdStartAt = sessionStartAt + 2 * dayMs;
		const thirdId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: thirdStartAt
		});

		await runSetup(t, firstId);
		await runSetup(t, secondId, secondStartAt);
		await runSetup(t, thirdId, thirdStartAt);
		await t.run((ctx) => ctx.db.patch(secondId, { status: "cancelled" }));

		const fourthStartAt = sessionStartAt + 3 * dayMs;
		const fourthId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: fourthStartAt
		});
		await runSetup(t, fourthId, fourthStartAt);

		// Number 2 stays reserved by the cancelled session's folder, so the replacement is 4.
		expect((await readDriveState(t, fourthId)).driveSession).toMatchObject({
			packageSessionNumber: 4
		});
		expect(
			driveFake.create.mock.calls.some(
				([request]) => request.requestBody?.name === "Session 04 - 13 Jan 2030 - 11:00 AM"
			)
		).toBe(true);
	});

	test("allocates distinct numbers when sessions are set up concurrently", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const dayMs = 24 * 60 * 60 * 1000;
		const secondStartAt = sessionStartAt + dayMs;
		const firstId = await seedBooking(t, { multiBookingPackageId: packageId });
		const secondId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: secondStartAt
		});

		await Promise.all([runSetup(t, firstId), runSetup(t, secondId, secondStartAt)]);

		const numbers = (
			await Promise.all(
				[firstId, secondId].map(async (bookingId) => {
					const state = await readDriveState(t, bookingId);
					return state.driveSession?.packageSessionNumber;
				})
			)
		).filter((number) => number !== undefined);
		expect(numbers.toSorted((a, b) => a - b)).toEqual([1, 2]);
	});

	test("reuses one package folder and the client assets library across sessions", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const dayMs = 24 * 60 * 60 * 1000;
		const firstId = await seedBooking(t, { multiBookingPackageId: packageId });
		const secondStartAt = sessionStartAt + dayMs;
		const secondId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: secondStartAt
		});
		// An ordinary session of the same client must share the client folder and assets library.
		const ordinaryId = await seedBooking(t, { sessionStartAt: sessionStartAt + 2 * dayMs });

		await runSetup(t, firstId);
		await runSetup(t, secondId, secondStartAt);
		await runSetup(t, ordinaryId, sessionStartAt + 2 * dayMs);

		const packageFolders = [...driveFake.folders.values()].filter(
			(folder) => folder.name === packageFolderName
		);
		const assetsFolders = [...driveFake.folders.values()].filter(
			(folder) => folder.name === "_Assets"
		);
		const clientFolders = [...driveFake.folders.values()].filter(
			(folder) => folder.name === "Test account (VV Studios)"
		);
		expect(packageFolders).toHaveLength(1);
		expect(assetsFolders).toHaveLength(1);
		expect(clientFolders).toHaveLength(1);
		// Every package session folder lives inside the one package folder.
		for (const bookingId of [firstId, secondId]) {
			const state = await readDriveState(t, bookingId);
			const sessionFolderId = state.driveSession?.sessionFolder?.id;
			const sessionFolder = [...driveFake.folders.values()].find(
				(folder) => folder.id === sessionFolderId
			);
			expect(sessionFolder?.parentId).toBe(packageFolders[0]?.id);
		}
	});

	test("grants the assigned editor access and sends the branded email for a package session", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const packageId = await seedPackage(t);
		const bookingId = await seedBooking(t, {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier,
			multiBookingPackageId: packageId
		});

		await runSetup(t, bookingId);
		await runEditorAccessSetup(t, bookingId);

		expect(
			driveFake.permissionsCreate.mock.calls
				.filter(([request]) => request.requestBody?.emailAddress === "editor@example.com")
				.map(([request]) => ({ fileId: request.fileId, role: request.requestBody?.role }))
		).toEqual([
			// The editor's session folder, the shared assets folder, and the deliverables folder.
			{ fileId: "folder-4", role: "reader" },
			{ fileId: "folder-2", role: "reader" },
			{ fileId: "folder-6", role: "writer" }
		]);
		expect((await readDriveState(t, bookingId)).driveSession).toMatchObject({
			editorDrivePermissionsStatus: "ready",
			assignmentEmailStatus: "sent"
		});
		expect(emailFake.sendEditorAssignmentEmail).toHaveBeenCalledTimes(1);
	});

	test("reports the package folder and numbered session label in the status query", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const bookingId = await seedBooking(t, { multiBookingPackageId: packageId });

		await runSetup(t, bookingId);
		const statusResult = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.getDriveStatus, { bookingId });
		const status = statusResult[1];

		expect(statusResult[0]).toBeNull();
		expect(status).toMatchObject({ status: "ready", packageFolderName, sessionFolderName });
		expect(status?.folders?.map((folder) => folder.name)).toEqual([
			"Assets",
			"Package",
			"Session",
			"Raw Media",
			"Deliverables"
		]);
	});

	test("shows a sibling session's package folder before this session is set up", async () => {
		const t = createConvexTest();
		const packageId = await seedPackage(t);
		const firstId = await seedBooking(t, { multiBookingPackageId: packageId });
		const secondStartAt = sessionStartAt + 24 * 60 * 60 * 1000;
		const secondId = await seedBooking(t, {
			multiBookingPackageId: packageId,
			sessionStartAt: secondStartAt
		});

		await runSetup(t, firstId);
		const firstStatus = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.getDriveStatus, { bookingId: firstId });
		const secondStatus = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.getDriveStatus, { bookingId: secondId });
		const firstPackageFolder = firstStatus[1]?.folders?.find((folder) => folder.name === "Package");
		const secondPackageFolder = secondStatus[1]?.folders?.find(
			(folder) => folder.name === "Package"
		);

		expect(secondStatus[0]).toBeNull();
		expect(secondStatus[1]).toMatchObject({ status: "incomplete", packageFolderName });
		expect(secondPackageFolder?.url).toBe(firstPackageFolder?.url);
		expect(secondPackageFolder?.url).toBeDefined();
		expect(secondStatus[1]?.folders?.map((folder) => folder.name)).toEqual(["Assets", "Package"]);
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
		assignedEditorTokenIdentifier?: string;
		status?: Doc<"bookings">["status"];
		withReservation?: boolean;
		sessionStartAt?: number;
		multiBookingPackageId?: Id<"multiBookingPackages">;
	} = {}
) {
	const bookingStartAt = options.sessionStartAt ?? sessionStartAt;
	return await t.run(async (ctx) => {
		// Mirror booking creation: reuse or insert a driveClients row without a folder and link it.
		const normalizedEmail = "customer@example.com";
		const existingClient = await ctx.db
			.query("driveClients")
			.withIndex("by_normalizedEmail", (query) => query.eq("normalizedEmail", normalizedEmail))
			.unique();
		const driveClientId =
			existingClient?._id ??
			(await ctx.db.insert("driveClients", {
				normalizedEmail,
				displayName: getClientFolderName({
					accountName: "Test account",
					contactName: "Test customer"
				}),
				createdAt: now
			}));
		return await ctx.db.insert("bookings", {
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
			assignedEditorTokenIdentifier: options.assignedEditorTokenIdentifier,
			status: options.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			multiBookingPackageId: options.multiBookingPackageId,
			driveClientId,
			...(options.withReservation
				? {
						reservationCreatedAt: now,
						reservationSessionStartAt: bookingStartAt,
						reservationDuration: "1h"
					}
				: {})
		});
	});
}

async function seedPackage(t: TestClient) {
	return await t.run((ctx) =>
		ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 10,
			discountAmount: 40,
			totalDueAmount: 360,
			status: "paid",
			createdAt: now,
			paidAt: now,
			invoiceDueAt: now,
			invoiceEmailStatus: "sent"
		})
	);
}

async function seedEditor(
	t: TestClient,
	identity = editorIdentity,
	email = "editor@example.com",
	displayName = "Test editor"
) {
	return await t.run((ctx) =>
		ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName,
			email,
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		})
	);
}

async function runEditorAccessSetup(t: TestClient, bookingId: Id<"bookings">) {
	return await t.action(internal.drive.setupEditorAccess, { bookingId });
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
