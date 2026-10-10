/**
 * Drive background-job recovery and cancellation safety through registered actions.
 *
 * 1. Partial setup recovery
 *    A failed child creation keeps saved folders and scheduled retry completes them.
 *
 * 2. Lost create response
 *    Scheduled setup finds a folder created by Google after its create response is lost.
 *
 * 3. Missing-folder recovery
 *    Scheduled setup leaves missing saved folders for admins to recreate.
 *
 * 4. Stale scheduled timing
 *    An old scheduled job cannot set up a rescheduled booking.
 *
 * 5. Independent access and email failures
 *    Client sharing/email failure does not undo folder setup or block editor access.
 *
 * 6. Cancellation safety
 *    Empty trees are removed, while uploaded media or external failure keeps records.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { google } from "googleapis";
import { z } from "zod";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { createConvexTest } from "#convex/test.setup";

// Mock only Google's HTTP boundary. Convex handlers, services and DB writes are real.
const googleDrive = {
	files: {
		create:
			vi.fn<
				(args: {
					requestBody: { name: string; appProperties: { vvWorkspaceMarker: string } };
				}) => Promise<{ data: { id: string; name: string; webViewLink: string } }>
			>(),
		get: vi.fn<
			(args: {
				fileId: string;
			}) => Promise<{ data: { id: string; name: string; webViewLink: string } }>
		>(),
		list: vi.fn<
			(args: {
				q: string;
			}) => Promise<{
				data: { files: { id: string; mimeType: string; name?: string; webViewLink?: string }[] };
			}>
		>(),
		update:
			vi.fn<
				(args: {
					fileId: string;
					requestBody: { name: string };
				}) => Promise<{ data: { id: string; name: string; webViewLink: string } }>
			>(),
		delete: vi.fn<(args: { fileId: string }) => Promise<void>>()
	},
	permissions: {
		list: vi.fn<() => Promise<{ data: { permissions: never[] } }>>(),
		create:
			vi.fn<
				(args: {
					requestBody: { emailAddress?: string; role: string; type: string };
				}) => Promise<{ data: { id: string; emailAddress?: string; role: string; type: string } }>
			>()
	}
};

const missingFolderIds = new Set<string>();

function parseRequestBody<T>(schema: z.ZodType<T>, init: RequestInit | undefined): T {
	return schema.parse(JSON.parse(z.string().parse(init?.body)));
}

async function sendGoogleRequest(input: RequestInfo | URL, init?: RequestInit) {
	const url = new URL(input instanceof Request ? input.url : input);
	const fileId = url.pathname.split("/")[4] ?? "";
	const method = init?.method ?? "GET";

	if (url.pathname.endsWith("/permissions")) {
		const response =
			method === "GET"
				? await googleDrive.permissions.list()
				: await googleDrive.permissions.create({
						requestBody: parseRequestBody(
							z.object({ emailAddress: z.string().optional(), role: z.string(), type: z.string() }),
							init
						)
					});

		return Response.json(response.data);
	}

	if (method === "DELETE") {
		await googleDrive.files.delete({ fileId });

		return new Response(null, { status: 204 });
	}

	if (method === "POST") {
		const requestBody = parseRequestBody(
			z.object({ name: z.string(), appProperties: z.object({ vvWorkspaceMarker: z.string() }) }),
			init
		);

		const response = await googleDrive.files.create({ requestBody });

		return Response.json(response.data);
	}

	if (method === "PATCH") {
		const requestBody = parseRequestBody(z.object({ name: z.string() }), init);
		const response = await googleDrive.files.update({ fileId, requestBody });

		return Response.json(response.data);
	}

	if (missingFolderIds.has(fileId)) return Response.json({ error: "Not found" }, { status: 404 });

	const response =
		fileId === ""
			? await googleDrive.files.list({ q: url.searchParams.get("q") ?? "" })
			: await googleDrive.files.get({ fileId });

	return Response.json(response.data);
}

const adminIdentity = { publicMetadata: { role: "admin" } };

const editorTokenIdentifier = "https://clerk.example|drive-editor";

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

function folder(id: string, name = id) {
	return { id, name, webViewLink: `https://drive.example/${id}` };
}

beforeEach(() => {
	vi.resetAllMocks();
	missingFolderIds.clear();

	const drive = google.drive({
		version: "v3",
		auth: "test-api-key",
		fetchImplementation: sendGoogleRequest,
		retry: false
	});

	vi.spyOn(google, "drive").mockReturnValue(drive);

	let nextFolder = 0;

	googleDrive.files.create.mockImplementation(({ requestBody }) =>
		Promise.resolve({ data: folder(`created-${++nextFolder}`, requestBody.name) })
	);
	googleDrive.files.get.mockImplementation(({ fileId }) =>
		Promise.resolve({ data: folder(fileId) })
	);
	googleDrive.files.update.mockImplementation(({ fileId, requestBody }) =>
		Promise.resolve({ data: folder(fileId, requestBody.name) })
	);
	googleDrive.files.list.mockResolvedValue({ data: { files: [] } });
	googleDrive.files.delete.mockResolvedValue(undefined);
	googleDrive.permissions.list.mockResolvedValue({ data: { permissions: [] } });
	googleDrive.permissions.create.mockImplementation(({ requestBody }) =>
		Promise.resolve({
			data: { id: `permission-${requestBody.emailAddress ?? "anyone"}`, ...requestBody }
		})
	);
	vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}")));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function seedBooking(t: TestClient, withEditor = false) {
	return await t.run(async (ctx) => {
		if (withEditor) {
			await ctx.db.insert("editorProfiles", {
				tokenIdentifier: editorTokenIdentifier,
				displayName: "Drive Editor",
				email: "editor@example.com",
				isActive: true,
				lastAssignedAt: null,
				totalEdits: 0
			});
		}

		return await ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Drive Customer",
				phone: "0400000000",
				accountName: "Drive account",
				email: "customer@example.com",
				date: "2030-01-10",
				time: "10:00",
				sessionStartAt,
				duration: "1h",
				service: "Table Setup",
				addons: ["Complete Edit"],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: sessionStartAt - 86400000,
				assignedEditorTokenIdentifier: withEditor ? editorTokenIdentifier : undefined
			})
		);
	});
}

async function seedSavedFolders(t: TestClient, bookingId: Id<"bookings">) {
	const [, client] = await t.mutation(internal.sessions.drive.saveDriveClientFolder, {
		normalizedEmail: "customer@example.com",
		displayName: "Drive Customer - Drive account",
		folder: folder("client")
	});

	if (client === null) throw new Error("Expected a saved Drive client");

	await t.mutation(internal.sessions.drive.saveDriveClientAssetsFolder, {
		driveClientId: client.driveClientId,
		folder: folder("assets")
	});
	await t.mutation(internal.sessions.drive.saveDriveSessionFolder, {
		bookingId,
		driveClientId: client.driveClientId,
		folder: folder("session")
	});
	await t.mutation(internal.sessions.drive.allocateClientSessionNumber, { bookingId });
	await t.mutation(internal.sessions.drive.saveDriveChildFolder, {
		bookingId,
		name: "Raw Media",
		folder: folder("raw")
	});
	await t.mutation(internal.sessions.drive.saveDriveChildFolder, {
		bookingId,
		name: "Deliverables",
		folder: folder("deliverables")
	});
}

async function readStatus(t: TestClient, bookingId: Id<"bookings">) {
	const [error, status] = await t
		.withIdentity(adminIdentity)
		.query(api.sessions.admin.getDriveStatus, { bookingId });

	if (error !== null) throw new Error(error.reason);

	return status;
}

function runScheduledSetup(t: TestClient, bookingId: Id<"bookings">, startAt = sessionStartAt) {
	return t.action(internal.googleCalendar.calendar.runScheduledDriveSetup, {
		bookingId,
		sessionStartAt: startAt,
		duration: "1h"
	});
}

describe("Drive action recovery", () => {
	test("scheduled retry completes partial setup without replacing saved folders", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const createFolder = googleDrive.files.create.getMockImplementation();

		if (createFolder === undefined) throw new Error("Expected Google SDK stub");

		googleDrive.files.create.mockImplementation((args) => {
			if (args.requestBody.appProperties.vvWorkspaceMarker.endsWith(":deliverables")) {
				return Promise.reject(new Error("Drive unavailable"));
			}

			return createFolder(args);
		});

		expect(await runScheduledSetup(t, bookingId)).toEqual([null, null]);
		const failed = await readStatus(t, bookingId);
		expect(failed).toMatchObject({
			status: "incomplete",
			driveSetupFailureCode: "GOOGLE_DRIVE_FOLDER_CREATE_FAILED",
			folders: [
				{ name: "Assets", url: "https://drive.example/created-2" },
				{ name: "Session", url: "https://drive.example/created-3" },
				{ name: "Raw Media", url: "https://drive.example/created-4" },
				{ name: "Deliverables" }
			]
		});

		googleDrive.files.create.mockImplementation(createFolder);
		expect(await runScheduledSetup(t, bookingId)).toEqual([null, null]);
		const recovered = await readStatus(t, bookingId);
		expect(recovered.driveSetupFailureCode).toBeUndefined();
		expect(recovered).toMatchObject({
			status: "ready",
			folders: [
				{ name: "Assets", url: "https://drive.example/created-2" },
				{ name: "Session", url: "https://drive.example/created-3" },
				{ name: "Raw Media", url: "https://drive.example/created-4" },
				{ name: "Deliverables", url: "https://drive.example/created-5" }
			]
		});
	});

	test("scheduled setup recovers a folder after Google loses its create response", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const createFolder = googleDrive.files.create.getMockImplementation();

		const externallyCreatedFolders = new Map<
			string,
			{ id: string; name: string; webViewLink: string }
		>();

		let loseFirstResponse = true;

		if (createFolder === undefined) throw new Error("Expected Google SDK stub");

		googleDrive.files.create.mockImplementation(async ({ requestBody }) => {
			const response = await createFolder({ requestBody });
			externallyCreatedFolders.set(requestBody.appProperties.vvWorkspaceMarker, response.data);

			if (loseFirstResponse) {
				loseFirstResponse = false;
				throw new Error("Google created the folder but the response was lost");
			}

			return response;
		});
		googleDrive.files.list.mockImplementation(({ q }) => {
			const marker = /value='([^']+)'/.exec(q)?.[1];
			const createdFolder = marker === undefined ? undefined : externallyCreatedFolders.get(marker);

			return Promise.resolve({
				data: {
					files:
						createdFolder === undefined
							? []
							: [{ ...createdFolder, mimeType: "application/vnd.google-apps.folder" }]
				}
			});
		});

		expect(await runScheduledSetup(t, bookingId)).toEqual([null, null]);
		expect(await readStatus(t, bookingId)).toMatchObject({
			status: "ready",
			folders: [
				{ name: "Assets", url: "https://drive.example/created-2" },
				{ name: "Session", url: "https://drive.example/created-3" },
				{ name: "Raw Media", url: "https://drive.example/created-4" },
				{ name: "Deliverables", url: "https://drive.example/created-5" }
			]
		});
		expect(googleDrive.files.create).toHaveBeenCalledTimes(5);
	});

	test("only admin retry recreates a missing saved folder", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		await seedSavedFolders(t, bookingId);
		missingFolderIds.add("raw");

		expect(await runScheduledSetup(t, bookingId)).toEqual([null, null]);
		expect(await readStatus(t, bookingId)).toMatchObject({
			driveSetupFailureCode: "GOOGLE_DRIVE_FOLDER_MISSING",
			folders: [
				{ name: "Assets", url: "https://drive.example/assets" },
				{ name: "Session", url: "https://drive.example/session" },
				{ name: "Raw Media", url: "https://drive.example/raw" },
				{ name: "Deliverables", url: "https://drive.example/deliverables" }
			]
		});

		expect(
			await t
				.withIdentity(adminIdentity)
				.action(api.googleCalendar.calendar.retryDriveSetup, { bookingId })
		).toEqual([null, null]);
		const recovered = await readStatus(t, bookingId);
		expect(recovered.driveSetupFailureCode).toBeUndefined();
		expect(recovered).toMatchObject({
			status: "ready",
			folders: [
				{ name: "Assets", url: "https://drive.example/assets" },
				{ name: "Session", url: "https://drive.example/session" },
				{ name: "Raw Media", url: "https://drive.example/created-1" },
				{ name: "Deliverables", url: "https://drive.example/deliverables" }
			]
		});
	});

	test("stale scheduled timing leaves the current booking untouched", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const before = await readStatus(t, bookingId);
		expect(await runScheduledSetup(t, bookingId, sessionStartAt - 3600000)).toEqual([null, null]);
		expect(await readStatus(t, bookingId)).toEqual(before);
	});

	test.each(["permissions", "email"] as const)(
		"client %s failure leaves folders ready and still grants editor access",
		async (failure) => {
			const t = createConvexTest();
			const bookingId = await seedBooking(t, true);

			if (failure === "permissions") {
				googleDrive.permissions.create.mockImplementation(({ requestBody }) => {
					if (requestBody.emailAddress === "customer@example.com") {
						return Promise.reject(new Error("Sharing unavailable"));
					}

					return Promise.resolve({
						data: { id: `permission-${requestBody.emailAddress ?? "anyone"}`, ...requestBody }
					});
				});
			} else {
				vi.stubGlobal(
					"fetch",
					vi
						.fn<typeof fetch>()
						.mockImplementation((_url, init) =>
							Promise.resolve(
								new Response("{}", {
									status: z.string().parse(init?.body).includes("customer@example.com") ? 500 : 200
								})
							)
						)
				);
			}

			expect(
				await t
					.withIdentity(adminIdentity)
					.action(api.googleCalendar.calendar.setupDrive, { bookingId })
			).toEqual([null, null]);
			const status = await readStatus(t, bookingId);
			expect(status.driveSetupFailureCode).toBeUndefined();
			expect(status).toMatchObject({
				status: "ready",
				clientDrivePermissions:
					failure === "permissions"
						? { status: "failed", assetsEmailStatus: "not_sent" }
						: { status: "ready", assetsEmailStatus: "failed" },
				editorDrivePermissions: { status: "ready", assignmentEmailStatus: "sent" }
			});
		}
	);
});

describe("cancelled Drive cleanup", () => {
	test("removes an empty nested tree and clears session folders", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		await seedSavedFolders(t, bookingId);
		googleDrive.files.list.mockImplementation(({ q }) =>
			Promise.resolve({
				data: {
					files: q.startsWith("'session'")
						? [{ id: "raw", mimeType: "application/vnd.google-apps.folder" }]
						: []
				}
			})
		);

		expect(
			await t.action(internal.googleCalendar.calendar.cleanupCancelledSessionDrive, { bookingId })
		).toEqual([null, null]);
		expect((await readStatus(t, bookingId)).folders).toEqual([
			{ name: "Assets", url: "https://drive.example/assets" },
			{ name: "Session" },
			{ name: "Raw Media" },
			{ name: "Deliverables" }
		]);
	});

	test.each(["uploaded media", "delete failure"] as const)(
		"keeps session records after %s",
		async (condition) => {
			const t = createConvexTest();
			const bookingId = await seedBooking(t);
			await seedSavedFolders(t, bookingId);
			const before = await readStatus(t, bookingId);

			if (condition === "uploaded media") {
				googleDrive.files.list.mockImplementation(({ q }) =>
					Promise.resolve({
						data: {
							files: q.startsWith("'session'")
								? [{ id: "raw", mimeType: "application/vnd.google-apps.folder" }]
								: [{ id: "recording", mimeType: "video/mp4" }]
						}
					})
				);
			} else {
				googleDrive.files.delete.mockRejectedValue(new Error("Drive unavailable"));
			}

			expect(
				await t.action(internal.googleCalendar.calendar.cleanupCancelledSessionDrive, { bookingId })
			).toEqual([null, null]);
			expect(await readStatus(t, bookingId)).toEqual(before);
		}
	);
});
