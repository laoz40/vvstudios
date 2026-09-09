/**
 * These tests check admin and editor authorization boundaries.
 *
 * 1. Reading admin data
 *    Signed-out users, customers, and editors must not read sensitive booking or package lists.
 *    Admins must be able to read both lists.
 *
 * 2. Representative admin mutation denial
 *    A representative admin-only mutation rejects signed-out users, customers, and active editors
 *    without side effects. Every admin mutation uses the same requirePermission guard.
 *
 * 3. Permission foundation
 *    Defines the complete permission set, maps roles to permissions, and checks the shared helper.
 *
 * 4. Editor profile access resolution
 *    Reports signed-out, admin, active editor, and unauthorized editor access.
 *
 * 5. Restricted editor sessions query
 *    Rejects signed-out callers and inactive editor profiles.
 *
 * 6. requirePermission guard
 *    Rejects signed-out callers, rejects inactive editors, distinguishes editor and admin access,
 *    and allows admins through the shared guard.
 */
import type { UserIdentity } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { requirePermission } from "#convex/lib/auth";
import { createConvexTest } from "#convex/test.setup";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "#/lib/permissions";
import { tupleErr, tupleOk } from "#/lib/result";

const paginationOpts = { cursor: null, numItems: 10 };
const listEditorSessions = makeFunctionReference<
	"query",
	{ paginationOpts: { cursor: string | null; numItems: number } },
	unknown
>("sessions:listEditorSessions");

const identities = [
	{ label: "anonymous users", identity: null, reason: "NOT_AUTHENTICATED" },
	{
		label: "non-admin users",
		identity: { publicMetadata: { role: "customer" } },
		reason: "NOT_AUTHORIZED"
	}
] as const;

describe("admin list authorization", () => {
	test.each(identities)("rejects $label from listSessions", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.sessions.listSessions, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason } }
		);
	});

	test("rejects active editors from the sensitive booking list", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);

		await expect(
			t.withIdentity(editorMetadataIdentity).query(api.sessions.listSessions, { paginationOpts })
		).rejects.toMatchObject({ data: { reason: "NOT_AUTHORIZED" } });
	});

	test.each(identities)("rejects $label from listPackages", async ({ identity, reason }) => {
		const t = createConvexTest();
		const client = identity === null ? t : t.withIdentity(identity);

		await expect(client.query(api.packages.listPackages, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason } }
		);
	});

	test("allows an admin to read bookings and packages", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity({ publicMetadata: { role: "admin" } });

		const [bookings, packages] = await Promise.all([
			admin.query(api.sessions.listSessions, { paginationOpts }),
			admin.query(api.packages.listPackages, { paginationOpts })
		]);

		expect(bookings.page).toEqual([]);
		expect(packages.page).toEqual([]);
	});
});

type TestClient = ReturnType<typeof createConvexTest>;

describe.each(identities)("admin mutation authorization rejects $label", ({ identity, reason }) => {
	test("from a representative admin-only mutation without side effects", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);
		const before = await readBooking(t, bookingId);
		const client = identity === null ? t : t.withIdentity(identity);

		const result = await client.mutation(api.sessions.archiveSession, {
			bookingId,
			archived: true
		});

		expect(result).toEqual([{ reason }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
	});
});

describe("admin mutation authorization rejects active editors", () => {
	test("from a representative admin-only mutation without side effects", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);
		const bookingId = await seedBooking(t);
		const before = await readBooking(t, bookingId);

		const result = await t
			.withIdentity(editorMetadataIdentity)
			.mutation(api.sessions.archiveSession, { bookingId, archived: true });

		expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
	});
});

async function seedBooking(t: TestClient): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "test@example.com",
			date: "2099-01-01",
			time: "10:00",
			sessionStartAt: 4_071_268_800_000,
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: 1,
			googleEventId: "event-id",
			googleCalendarId: "calendar-id"
		})
	);
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}

const adminIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|admin",
	subject: "admin",
	issuer: "https://clerk.example",
	publicMetadata: { role: "admin" }
};

const editorMetadataIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor",
	subject: "editor",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

async function seedEditorProfile(
	t: TestClient,
	identity: UserIdentity,
	isActive: boolean
): Promise<void> {
	await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName: "Test Editor",
			email: "editor@example.com",
			isActive,
			lastAssignedAt: null,
			totalEdits: 0
		});
	});
}

describe("permission definitions", () => {
	test("defines the complete permission set", () => {
		expect(PERMISSIONS).toEqual([
			"view:sessions",
			"view:packages",
			"view:sensitive-booking-data",
			"update:deliverables",
			"send:deliverables-email",
			"assign:session-editor",
			"update:editor-access",
			"edit:sessions",
			"archive:sessions",
			"delete:sessions",
			"create:reschedule-links",
			"update:payment-status",
			"create:invoices",
			"send:invoice-emails",
			"update:availability"
		]);
		expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
	});

	test("maps roles to their exact permissions", () => {
		expect(ROLE_PERMISSIONS.admin).toBe(PERMISSIONS);
		expect(ROLE_PERMISSIONS.editor).toEqual(["view:sessions", "update:deliverables"]);
	});

	test("checks permissions from a supplied permission list", () => {
		expect(hasPermission(ROLE_PERMISSIONS.editor, "view:sessions")).toBe(true);
		expect(hasPermission(ROLE_PERMISSIONS.editor, "view:packages")).toBe(false);
	});
});

describe("editor profile access resolution", () => {
	test("reports signed-out access without a role or permissions", async () => {
		const result = await createConvexTest().query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([{ reason: "NOT_AUTHENTICATED" }, null]);
	});

	test("reports an admin's real role and complete permissions without a profile", async () => {
		const result = await createConvexTest()
			.withIdentity(adminIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([
			null,
			{ role: "admin", permissions: PERMISSIONS, editorProfile: null }
		]);
	});

	test("reports an active editor's real role and restricted permissions", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);

		const result = await t
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([null, { role: "editor", permissions: ROLE_PERMISSIONS.editor }]);
	});

	test("denies an authenticated identity without an active editor profile", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, false);

		const inactiveResult = await t
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(inactiveResult).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);

		const missingProfileResult = await createConvexTest()
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(missingProfileResult).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});
});

describe("restricted editor sessions authorization", () => {
	test("rejects signed-out callers", async () => {
		await expect(
			createConvexTest().query(listEditorSessions, { paginationOpts })
		).rejects.toMatchObject({ data: { reason: "NOT_AUTHENTICATED" } });
	});

	test("rejects callers without an active editor profile", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, false);

		await expect(
			t.withIdentity(editorMetadataIdentity).query(listEditorSessions, { paginationOpts })
		).rejects.toMatchObject({ data: { reason: "NOT_AUTHORIZED" } });
	});
});

describe("requirePermission", () => {
	test("rejects signed-out callers", async () => {
		const result = await createConvexTest().run((ctx) =>
			requirePermission(ctx, "view:sessions").match(tupleOk, tupleErr)
		);

		expect(result).toEqual([{ reason: "NOT_AUTHENTICATED" }, null]);
	});

	test("rejects editors without an active profile", async () => {
		const t = createConvexTest();

		await expect(
			t.withIdentity(editorMetadataIdentity).query(api.sessions.listSessions, { paginationOpts })
		).rejects.toMatchObject({ data: { reason: "NOT_AUTHORIZED" } });
	});

	test("allows an active editor permission but denies an admin-only permission", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);
		const editor = t.withIdentity(editorMetadataIdentity);

		const editorPermission = await editor.run((ctx) =>
			requirePermission(ctx, "view:sessions").match(tupleOk, tupleErr)
		);
		expect(editorPermission).toMatchObject([null, editorMetadataIdentity]);
		await expect(editor.query(api.packages.listPackages, { paginationOpts })).rejects.toMatchObject(
			{ data: { reason: "NOT_AUTHORIZED" } }
		);
	});

	test("allows admins through the shared guard", async () => {
		const result = await createConvexTest()
			.withIdentity(adminIdentity)
			.run((ctx) => requirePermission(ctx, "archive:sessions").match(tupleOk, tupleErr));

		expect(result).toMatchObject([null, adminIdentity]);
	});
});
