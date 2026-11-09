/**
 * Editor delivery through the existing client email action and session mutation.
 *
 * 1. Client delivery
 *    The email contains the saved Drive link and client notes. Marking the session
 *    for review saves the notes without scheduling an admin notification.
 *
 * 2. Email failure
 *    Transport and provider failures return the email error and preserve the
 *    session's uploading status and previously saved client notes.
 *
 * 3. Toggleable editor permission
 *    Delivery is disabled by default. Only admins can enable or revoke it, and
 *    editors cannot email clients or mark delivery complete without permission.
 *    Other editing status updates and requesting admin review remain available.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { google } from "googleapis";
import { z } from "zod";
import { api } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";

const editorIdentity = {
	tokenIdentifier: "https://clerk.example|delivery-editor",
	publicMetadata: { role: "editor" }
};

beforeEach(() => {
	const drive = google.drive({
		version: "v3",
		auth: "test-api-key",
		retry: false,
		fetchImplementation: (input) => {
			const url = new URL(input instanceof Request ? input.url : input);

			return Promise.resolve(
				Response.json(
					url.pathname.endsWith("/permissions")
						? { permissions: [{ id: "public-reader", type: "anyone", role: "reader" }] }
						: { files: [{ id: "finished-edit", mimeType: "video/mp4" }] }
				)
			);
		}
	});

	vi.spyOn(google, "drive").mockReturnValue(drive);
});

afterEach(() => vi.restoreAllMocks());

async function seedDeliverySession(
	t: ReturnType<typeof createConvexTest>,
	canSendDeliverables?: boolean
) {
	return t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: editorIdentity.tokenIdentifier,
			displayName: "Delivery Editor",
			email: "editor@example.com",
			isActive: true,
			canSendDeliverables,
			lastAssignedAt: null,
			totalEdits: 0
		});

		const bookingId = await ctx.db.insert(
			"bookings",
			bookingDocument({
				name: "Delivery Customer",
				phone: "0400000000",
				accountName: "Delivery Account",
				email: "delivery@example.com",
				date: "2020-01-10",
				time: "10:00",
				sessionStartAt: Date.parse("2020-01-09T23:00:00.000Z"),
				duration: "1 hour",
				service: "Remote Podcast",
				addons: ["Essential Edit"],
				status: "confirmed",
				archived: false,
				pendingPaymentCreatedAt: Date.parse("2020-01-01T00:00:00.000Z"),
				editStatus: "uploading",
				deliverablesClientNotes: "Previous notes",
				assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
			})
		);

		const driveClientId = await ctx.db.insert("driveClients", {
			normalizedEmail: "delivery@example.com",
			displayName: "Delivery Customer",
			createdAt: Date.now()
		});

		await ctx.db.insert("driveSessions", {
			bookingId,
			driveClientId,
			deliverablesFolder: {
				id: "delivery-folder",
				url: "https://drive.google.com/drive/folders/delivery-folder"
			},
			createdAt: Date.now(),
			updatedAt: Date.now()
		});

		return bookingId;
	});
}

const emailSchema = z.object({ to: z.array(z.string()), html: z.string() });

describe("editor client delivery", () => {
	test("emails the client their Drive link and notes, then marks the session for review", async () => {
		const t = createConvexTest();
		const bookingId = await seedDeliverySession(t, true);
		const editor = t.withIdentity(editorIdentity);

		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ id: "sent" }));

		const sent = await editor.action(api.editor.deliverablesEmail.sendSessionDeliverablesEmail, {
			bookingId,
			editorNotes: "  Please check the opening title.  "
		});

		expect(sent).toEqual([null, null]);

		const email = emailSchema.parse(
			JSON.parse(z.string().parse(fetchMock.mock.calls[0]?.[1]?.body))
		);

		expect(email.to).toEqual(["delivery@example.com"]);
		expect(email.html).toContain("https://drive.google.com/drive/folders/delivery-folder");
		expect(email.html).toContain("Please check the opening title.");

		const updated = await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
			bookingId,
			editStatus: "review",
			deliverablesClientNotes: "  Please check the opening title.  "
		});

		expect(updated).toEqual([null, null]);

		const session = await t.run((ctx) => ctx.db.get("bookings", bookingId));
		expect(session).toMatchObject({
			editStatus: "review",
			deliverablesClientNotes: "Please check the opening title."
		});
		expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
	});

	test.each(["EMAIL_REQUEST_FAILED", "EMAIL_RESPONSE_FAILED"] as const)(
		"preserves the session status and saved notes on %s",
		async (reason) => {
			const t = createConvexTest();
			const bookingId = await seedDeliverySession(t, true);
			const fetchMock = vi.spyOn(globalThis, "fetch");

			if (reason === "EMAIL_REQUEST_FAILED") {
				fetchMock.mockRejectedValue(new Error("Email service unavailable"));
			} else {
				fetchMock.mockResolvedValue(new Response("Email rejected", { status: 503 }));
			}

			const result = await t
				.withIdentity(editorIdentity)
				.action(api.editor.deliverablesEmail.sendSessionDeliverablesEmail, {
					bookingId,
					editorNotes: "New notes"
				});

			expect(result).toEqual([{ reason }, null]);

			const session = await t.run((ctx) => ctx.db.get("bookings", bookingId));
			expect(session).toMatchObject({
				editStatus: "uploading",
				deliverablesClientNotes: "Previous notes"
			});
		}
	);

	test("denies client delivery by default while permitting edits and admin review", async () => {
		const t = createConvexTest();
		const bookingId = await seedDeliverySession(t);
		const editor = t.withIdentity(editorIdentity);

		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "sent" }));

		const initialAccess = await editor.query(api.shared.auth.getCurrentUserAccess, {});
		expect(initialAccess[1]?.permissions).toEqual(["view:sessions", "update:deliverables"]);
		expect(
			await editor.action(api.editor.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId })
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);

		expect(
			await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
				bookingId,
				editStatus: "completed"
			})
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);

		expect(await t.run((ctx) => ctx.db.get("bookings", bookingId))).toMatchObject({
			editStatus: "uploading"
		});
		expect(
			await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
				bookingId,
				editStatus: "editing"
			})
		).toEqual([null, null]);
		expect(await t.run((ctx) => ctx.db.get("bookings", bookingId))).toMatchObject({
			editStatus: "editing"
		});

		expect(
			await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
				bookingId,
				editStatus: "review"
			})
		).toEqual([null, null]);
		expect(await t.run((ctx) => ctx.db.get("bookings", bookingId))).toMatchObject({
			editStatus: "review"
		});
	});

	test("only admins can enable delivery, and revocation blocks further delivery", async () => {
		const t = createConvexTest();
		const bookingId = await seedDeliverySession(t);
		const editor = t.withIdentity(editorIdentity);
		const admin = t.withIdentity({ publicMetadata: { role: "admin" } });

		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "sent" }));

		const permissionArgs = {
			tokenIdentifier: editorIdentity.tokenIdentifier,
			canSendDeliverables: true
		};

		expect(
			await editor.mutation(api.employees.admin.updateEmployeeDeliveryPermission, permissionArgs)
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(
			await admin.mutation(api.employees.admin.updateEmployeeDeliveryPermission, permissionArgs)
		).toEqual([null, null]);

		const enabledAccess = await editor.query(api.shared.auth.getCurrentUserAccess, {});
		expect(enabledAccess[1]?.permissions).toEqual([
			"view:sessions",
			"update:deliverables",
			"send:deliverables-email"
		]);
		expect(
			await editor.action(api.editor.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId })
		).toEqual([null, null]);
		expect(
			await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
				bookingId,
				editStatus: "review"
			})
		).toEqual([null, null]);

		expect(
			await admin.mutation(api.employees.admin.updateEmployeeDeliveryPermission, {
				...permissionArgs,
				canSendDeliverables: false
			})
		).toEqual([null, null]);

		const revokedAccess = await editor.query(api.shared.auth.getCurrentUserAccess, {});
		expect(revokedAccess[1]?.permissions).toEqual(["view:sessions", "update:deliverables"]);
		expect(
			await editor.action(api.editor.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId })
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(
			await editor.mutation(api.sessions.admin.updateSessionEditStatus, {
				bookingId,
				editStatus: "completed"
			})
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(await t.run((ctx) => ctx.db.get("bookings", bookingId))).toMatchObject({
			editStatus: "review"
		});
	});
});
