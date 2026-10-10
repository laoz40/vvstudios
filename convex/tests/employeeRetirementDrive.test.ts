/**
 * Editor retirement removes Google Drive permissions through the registered employee and Drive APIs.
 *
 * 1. Retiring saved Drive access
 *    Revokes unfinished and completed session permissions and shared assets access, including a
 *    historical client with no current assignment from the retired editor.
 *
 * 2. Retrying a failed permission removal
 *    Keeps the external permission available for retry after Google rejects the first delete.
 *
 * 3. Completing a setup after retirement
 *    Removes a Google permission created after the editor was retired instead of saving access.
 *
 * 4. Independent client cleanup
 *    A failed shared-assets removal for one client does not prevent removal for another client.
 *
 * 5. Immediate replacement assignment
 *    A replacement editor keeps new Drive grants while retirement clears the prior editor's grants.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { google } from "googleapis";
import { z } from "zod";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { createConvexTest } from "#convex/test.setup";

const adminIdentity = { publicMetadata: { role: "admin" } };

const editorTokenIdentifier = "https://clerk.example|retiring-drive-editor";

const editorEmail = "retiring-drive@example.com";

const replacementEditorTokenIdentifier = "https://clerk.example|replacement-drive-editor";

const replacementEditorEmail = "replacement-drive@example.com";

const customerAssetsFolderId = "customer-assets-folder";

type TestClient = ReturnType<typeof createConvexTest>;

type DriveGrant = { id: string; emailAddress: string; role: string; type: "user" };

type DeleteRequest = { fileId: string; permissionId: string };

const remotePermissions = new Map<string, DriveGrant[]>();

const deleteRequests: DeleteRequest[] = [];

const failedDeletePermissionIds = new Set<string>();

let holdNextPermissionCreate = false;

let permissionCreateStarted: Promise<void> = Promise.resolve();

let signalPermissionCreateStarted = () => {};

let releasePermissionCreate: (() => void) | undefined;

let lastCreatedPermission: { fileId: string; permissionId: string } | undefined;

function parseRequestBody<T>(schema: z.ZodType<T>, init: RequestInit | undefined): T {
	return schema.parse(JSON.parse(z.string().parse(init?.body)));
}

function fileIdFromPath(pathname: string) {
	return /\/files\/([^/]+)\/permissions/.exec(pathname)?.[1] ?? "";
}

async function sendGoogleDriveRequest(input: RequestInfo | URL, init?: RequestInit) {
	const url = new URL(input instanceof Request ? input.url : input);
	const method = init?.method ?? "GET";
	const fileId = fileIdFromPath(url.pathname);

	if (method === "GET" && url.pathname.endsWith("/permissions")) {
		return Response.json({ permissions: remotePermissions.get(fileId) ?? [] });
	}

	if (method === "DELETE") {
		const permissionId = url.pathname.split("/").at(-1) ?? "";
		deleteRequests.push({ fileId, permissionId });

		if (failedDeletePermissionIds.delete(permissionId)) {
			return Response.json(
				{ error: { code: 500, message: "Drive temporarily rejected permission removal" } },
				{ status: 500 }
			);
		}

		remotePermissions.set(
			fileId,
			(remotePermissions.get(fileId) ?? []).filter((permission) => permission.id !== permissionId)
		);

		return new Response(null, { status: 204 });
	}

	if (method === "POST" && url.pathname.endsWith("/permissions")) {
		const requestBody = parseRequestBody(
			z.object({ emailAddress: z.string(), role: z.string(), type: z.literal("user") }),
			init
		);

		const permissionId = `created-${fileId}`;
		lastCreatedPermission = { fileId, permissionId };

		if (holdNextPermissionCreate) {
			holdNextPermissionCreate = false;
			signalPermissionCreateStarted();
			await new Promise<void>((resolve) => {
				releasePermissionCreate = resolve;
			});
		}

		const permission: DriveGrant = { id: permissionId, ...requestBody };
		remotePermissions.set(fileId, [...(remotePermissions.get(fileId) ?? []), permission]);

		return Response.json(permission);
	}

	return Response.json(
		{ error: { code: 404, message: "Unexpected Drive request" } },
		{ status: 404 }
	);
}

function addRemotePermission(fileId: string, permission: DriveGrant) {
	remotePermissions.set(fileId, [...(remotePermissions.get(fileId) ?? []), permission]);
}

beforeEach(() => {
	vi.useFakeTimers();
	remotePermissions.clear();
	deleteRequests.length = 0;
	failedDeletePermissionIds.clear();
	holdNextPermissionCreate = false;
	releasePermissionCreate = undefined;
	lastCreatedPermission = undefined;
	permissionCreateStarted = new Promise<void>((resolve) => {
		signalPermissionCreateStarted = resolve;
	});

	const drive = google.drive({
		version: "v3",
		auth: "test-api-key",
		fetchImplementation: sendGoogleDriveRequest,
		retry: false
	});

	vi.spyOn(google, "drive").mockReturnValue(drive);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

async function finishScheduledFunctions(t: TestClient) {
	await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

async function seedRetirementData(t: TestClient) {
	return await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: editorTokenIdentifier,
			displayName: "Retiring Drive Editor",
			email: editorEmail,
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		});

		const driveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "customer@example.com",
			displayName: "Customer",
			assetsFolder: {
				id: customerAssetsFolderId,
				url: `https://drive.example/${customerAssetsFolderId}`
			},
			createdAt: 100
		});

		const bookings = await Promise.all(
			(["review", "completed"] as const).map((editStatus, index) =>
				ctx.db.insert(
					"bookings",
					bookingDocument({
						name: `Customer ${index}`,
						phone: `040000000${index}`,
						accountName: "Customer account",
						email: "customer@example.com",
						date: "2030-01-10",
						time: "10:00",
						sessionStartAt: Date.parse("2030-01-10T00:00:00.000Z") + index * 60_000,
						duration: "1h",
						service: "Remote Podcast",
						addons: [],
						status: "confirmed",
						archived: false,
						pendingPaymentCreatedAt: Date.parse("2030-01-01T00:00:00.000Z"),
						assignedEditorTokenIdentifier: editorTokenIdentifier,
						assignedEditorDisplayName: "Retiring Drive Editor",
						driveClientId,
						editStatus
					})
				)
			)
		);

		await Promise.all(
			bookings.map(async (bookingId, index) => {
				const sessionPermission = {
					id: `session-permission-${index}`,
					emailAddress: editorEmail,
					role: "reader"
				} satisfies NonNullable<Doc<"driveSessions">["editorSessionPermission"]>;

				const deliverablesPermission = {
					id: `deliverables-permission-${index}`,
					emailAddress: editorEmail,
					role: "writer"
				} satisfies NonNullable<Doc<"driveSessions">["editorDeliverablesPermission"]>;

				return await ctx.db.insert("driveSessions", {
					bookingId,
					driveClientId,
					sessionFolder: {
						id: `session-folder-${index}`,
						url: `https://drive.example/session-folder-${index}`
					},
					rawMediaFolder: {
						id: `raw-folder-${index}`,
						url: `https://drive.example/raw-folder-${index}`
					},
					deliverablesFolder: {
						id: `deliverables-folder-${index}`,
						url: `https://drive.example/deliverables-folder-${index}`
					},
					editorDrivePermissionsStatus: "ready",
					editorDrivePermissionsTokenIdentifier: editorTokenIdentifier,
					editorSessionPermission: sessionPermission,
					editorDeliverablesPermission: deliverablesPermission,
					createdAt: 100,
					updatedAt: 100
				});
			})
		);

		await ctx.db.insert("driveClientEditorPermissions", {
			driveClientId,
			editorTokenIdentifier,
			assetsPermission: { id: "assets-permission", emailAddress: editorEmail, role: "reader" },
			createdAt: 100,
			updatedAt: 100
		});

		const orphanDriveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "orphan@example.com",
			displayName: "Historical customer",
			assetsFolder: {
				id: "orphan-assets-folder",
				url: "https://drive.example/orphan-assets-folder"
			},
			createdAt: 100
		});

		const orphanBookingId = await ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Historical customer",
				phone: "0400000009",
				accountName: "Historical account",
				email: "orphan@example.com",
				date: "2030-01-10",
				time: "11:00",
				sessionStartAt: Date.parse("2030-01-10T01:00:00.000Z"),
				duration: "1h",
				service: "Remote Podcast",
				addons: [],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: Date.parse("2030-01-01T00:00:00.000Z"),
				driveClientId: orphanDriveClientId,
				editStatus: "completed"
			})
		);

		await ctx.db.insert("driveSessions", {
			bookingId: orphanBookingId,
			driveClientId: orphanDriveClientId,
			sessionFolder: {
				id: "orphan-session-folder",
				url: "https://drive.example/orphan-session-folder"
			},
			deliverablesFolder: {
				id: "orphan-deliverables-folder",
				url: "https://drive.example/orphan-deliverables-folder"
			},
			editorDrivePermissionsStatus: "ready",
			editorDrivePermissionsTokenIdentifier: editorTokenIdentifier,
			editorSessionPermission: {
				id: "orphan-session-permission",
				emailAddress: editorEmail,
				role: "reader"
			},
			editorDeliverablesPermission: {
				id: "orphan-deliverables-permission",
				emailAddress: editorEmail,
				role: "writer"
			},
			createdAt: 100,
			updatedAt: 100
		});
		await ctx.db.insert("driveClientEditorPermissions", {
			driveClientId: orphanDriveClientId,
			editorTokenIdentifier,
			assetsPermission: {
				id: "orphan-assets-permission",
				emailAddress: editorEmail,
				role: "reader"
			},
			createdAt: 100,
			updatedAt: 100
		});

		return { bookings, driveClientId, orphanBookingId };
	});
}

function requireBookingId(bookings: Id<"bookings">[], index: number) {
	const bookingId = bookings[index];

	if (bookingId === undefined) throw new Error(`Expected booking ${index}`);

	return bookingId;
}

function seedRemoteGrants() {
	addRemotePermission("session-folder-0", {
		id: "session-permission-0",
		emailAddress: editorEmail,
		role: "reader",
		type: "user"
	});
	addRemotePermission("deliverables-folder-0", {
		id: "deliverables-permission-0",
		emailAddress: editorEmail,
		role: "writer",
		type: "user"
	});
	addRemotePermission("session-folder-1", {
		id: "session-permission-1",
		emailAddress: editorEmail,
		role: "reader",
		type: "user"
	});
	addRemotePermission("deliverables-folder-1", {
		id: "deliverables-permission-1",
		emailAddress: editorEmail,
		role: "writer",
		type: "user"
	});
	addRemotePermission(customerAssetsFolderId, {
		id: "assets-permission",
		emailAddress: editorEmail,
		role: "reader",
		type: "user"
	});
	addRemotePermission("orphan-session-folder", {
		id: "orphan-session-permission",
		emailAddress: editorEmail,
		role: "reader",
		type: "user"
	});
	addRemotePermission("orphan-deliverables-folder", {
		id: "orphan-deliverables-permission",
		emailAddress: editorEmail,
		role: "writer",
		type: "user"
	});
	addRemotePermission("orphan-assets-folder", {
		id: "orphan-assets-permission",
		emailAddress: editorEmail,
		role: "reader",
		type: "user"
	});
}

describe("employee retirement Drive cleanup", () => {
	test("revokes unfinished and completed session access plus shared assets", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);
		const { bookings } = await seedRetirementData(t);
		seedRemoteGrants();

		expect(
			await admin.mutation(api.employees.employees.updateEmployeeAccess, {
				tokenIdentifier: editorTokenIdentifier,
				isActive: false
			})
		).toEqual([null, null]);
		await finishScheduledFunctions(t);

		expect(deleteRequests).toHaveLength(8);
		expect(deleteRequests).toEqual(
			expect.arrayContaining([
				{ fileId: "session-folder-0", permissionId: "session-permission-0" },
				{ fileId: "deliverables-folder-0", permissionId: "deliverables-permission-0" },
				{ fileId: "session-folder-1", permissionId: "session-permission-1" },
				{ fileId: "deliverables-folder-1", permissionId: "deliverables-permission-1" },
				{ fileId: customerAssetsFolderId, permissionId: "assets-permission" },
				{ fileId: "orphan-session-folder", permissionId: "orphan-session-permission" },
				{ fileId: "orphan-deliverables-folder", permissionId: "orphan-deliverables-permission" },
				{ fileId: "orphan-assets-folder", permissionId: "orphan-assets-permission" }
			])
		);
		expect([...remotePermissions.values()].flat()).toEqual([]);

		const completedBookingId = requireBookingId(bookings, 1);

		const [retiredStatusError, retiredStatus] = await admin.query(
			api.sessions.sessions.getDriveStatus,
			{ bookingId: completedBookingId }
		);

		expect(retiredStatusError).toBeNull();
		expect(retiredStatus?.editorDrivePermissions.status).toBe("revoked");

		expect(
			await admin.mutation(api.employees.employees.updateEmployeeAccess, {
				tokenIdentifier: editorTokenIdentifier,
				isActive: true
			})
		).toEqual([null, null]);

		const [reactivatedStatusError, reactivatedStatus] = await admin.query(
			api.sessions.sessions.getDriveStatus,
			{ bookingId: completedBookingId }
		);

		expect(reactivatedStatusError).toBeNull();
		expect(reactivatedStatus?.editorDrivePermissions.status).toBe("revoked");
	});

	test("a failed Google deletion can be completed through the public retry action", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);
		const { bookings } = await seedRetirementData(t);
		seedRemoteGrants();
		failedDeletePermissionIds.add("session-permission-0");
		failedDeletePermissionIds.add("session-permission-1");

		expect(
			await admin.mutation(api.employees.employees.updateEmployeeAccess, {
				tokenIdentifier: editorTokenIdentifier,
				isActive: false
			})
		).toEqual([null, null]);
		await finishScheduledFunctions(t);

		expect(remotePermissions.get("session-folder-0")).toContainEqual(
			expect.objectContaining({ id: "session-permission-0", emailAddress: editorEmail })
		);
		expect(remotePermissions.get("session-folder-1")).toContainEqual(
			expect.objectContaining({ id: "session-permission-1", emailAddress: editorEmail })
		);

		expect(
			await admin.action(api.drive.drive.retryPreviousEditorRemoval, {
				bookingId: requireBookingId(bookings, 0)
			})
		).toEqual([null, null]);
		expect(
			await admin.action(api.drive.drive.retryPreviousEditorRemoval, {
				bookingId: requireBookingId(bookings, 1)
			})
		).toEqual([null, null]);

		expect(deleteRequests).toContainEqual({
			fileId: "session-folder-0",
			permissionId: "session-permission-0"
		});
		expect(deleteRequests).toContainEqual({
			fileId: "session-folder-1",
			permissionId: "session-permission-1"
		});
		expect(remotePermissions.get("session-folder-0")).toEqual([]);
		expect(remotePermissions.get("session-folder-1")).toEqual([]);
		expect([...remotePermissions.values()].flat()).toEqual([]);

		const [driveStatusError, completedDriveStatus] = await admin.query(
			api.sessions.sessions.getDriveStatus,
			{ bookingId: requireBookingId(bookings, 1) }
		);

		expect(driveStatusError).toBeNull();
		expect(completedDriveStatus?.editorDrivePermissions.status).toBe("revoked");
	});

	test("removes a Drive permission created after the editor has been retired", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);
		const { bookings } = await seedRetirementData(t);
		holdNextPermissionCreate = true;

		const setupPromise = admin.action(api.drive.drive.retryEditorAccess, {
			bookingId: requireBookingId(bookings, 0)
		});

		await permissionCreateStarted;

		expect(
			await admin.mutation(api.employees.employees.updateEmployeeAccess, {
				tokenIdentifier: editorTokenIdentifier,
				isActive: false
			})
		).toEqual([null, null]);
		await finishScheduledFunctions(t);

		if (releasePermissionCreate === undefined) throw new Error("Expected a pending Google create");
		releasePermissionCreate();

		expect(await setupPromise).toEqual([{ reason: "EDITOR_NOT_ACTIVE" }, null]);

		if (lastCreatedPermission === undefined)
			throw new Error("Expected a created Google permission");
		expect(deleteRequests).toContainEqual(lastCreatedPermission);
		expect(remotePermissions.get(lastCreatedPermission.fileId)).toEqual([]);

		const [driveStatusError, driveStatus] = await admin.query(
			api.sessions.sessions.getDriveStatus,
			{ bookingId: requireBookingId(bookings, 0) }
		);

		expect(driveStatusError).toBeNull();
		expect(driveStatus?.editorDrivePermissions.status).toBe("not_assigned");
	});

	test("an asset deletion failure does not block another client's retired access removal", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);
		await seedRetirementData(t);
		seedRemoteGrants();
		failedDeletePermissionIds.add("assets-permission");

		await admin.mutation(api.employees.employees.updateEmployeeAccess, {
			tokenIdentifier: editorTokenIdentifier,
			isActive: false
		});
		await finishScheduledFunctions(t);

		expect(deleteRequests).toContainEqual({
			fileId: customerAssetsFolderId,
			permissionId: "assets-permission"
		});
		expect(deleteRequests).toContainEqual({
			fileId: "orphan-assets-folder",
			permissionId: "orphan-assets-permission"
		});
		expect(remotePermissions.get("orphan-assets-folder")).toEqual([]);
	});

	test("immediate reassignment keeps replacement Drive grants and removes the retired editor", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);
		const { bookings } = await seedRetirementData(t);
		seedRemoteGrants();
		await t.run((ctx) =>
			ctx.db.insert("editorProfiles", {
				tokenIdentifier: replacementEditorTokenIdentifier,
				displayName: "Replacement Drive Editor",
				email: replacementEditorEmail,
				isActive: true,
				lastAssignedAt: null,
				totalEdits: 0
			})
		);

		expect(
			await admin.mutation(api.employees.employees.updateEmployeeAccess, {
				tokenIdentifier: editorTokenIdentifier,
				isActive: false
			})
		).toEqual([null, null]);
		expect(
			await admin.mutation(api.sessions.sessions.assignSessionEditor, {
				bookingId: requireBookingId(bookings, 0),
				editorTokenIdentifier: replacementEditorTokenIdentifier,
				adminNotes: "Reassign after retirement"
			})
		).toEqual([null, null]);

		await finishScheduledFunctions(t);

		expect(
			[...remotePermissions.values()]
				.flat()
				.filter((permission) => permission.emailAddress === editorEmail)
		).toEqual([]);
		expect(
			[...remotePermissions.values()]
				.flat()
				.filter((permission) => permission.emailAddress === replacementEditorEmail)
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "created-session-folder-0",
					emailAddress: replacementEditorEmail,
					role: "reader"
				}),
				expect.objectContaining({
					id: `created-${customerAssetsFolderId}`,
					emailAddress: replacementEditorEmail,
					role: "reader"
				}),
				expect.objectContaining({
					id: "created-deliverables-folder-0",
					emailAddress: replacementEditorEmail,
					role: "writer"
				})
			])
		);
	});
});
