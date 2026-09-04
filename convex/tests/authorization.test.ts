/**
 * These tests check who can use the admin dashboard features for sessions and packages.
 * They cover signed-out users, signed-in customers, and admins.
 *
 * 1. Reading admin data
 *    Signed-out users, customers, and editors must not read the booking or package lists because
 *    they contain private customer and payment data. Admins must be able to read both lists.
 *
 * 2. Running admin-only operations
 *    The following operations are tested:
 *    - mark a session's remaining balance as paid or unpaid;
 *    - mark a package as paid or unpaid, and confirm a package payment;
 *    - change a package adjustment's payment status;
 *    - change booking availability settings;
 *    - edit or archive a session;
 *    - edit or archive a package;
 *    - delete a session's Google Calendar event;
 *    - send session deliverables and invoice emails;
 *    - send a package invoice email;
 *    - generate a new session reschedule link;
 *    - create a custom invoice for a session or package;
 *    - assign an editor to a session.
 *    - invite a user.
 *
 *    Every operation is attempted as both a signed-out user and a customer. Every operation
 *    guarded by an admin-only permission is also attempted by an active editor. Each attempt
 *    must return the correct authorization error and leave all relevant database records
 *    unchanged. This proves unauthorized requests cannot cause hidden side effects.
 *
 * 3. Permission foundation
 *    - defines the complete permission set exactly once;
 *    - maps admins and editors to their exact permissions;
 *    - checks granted and denied permissions with the shared frontend helper;
 *    - rejects signed-out callers from the backend permission guard;
 *    - rejects editors without an active profile;
 *    - allows active editors to satisfy an editor permission but denies an admin-only permission;
 *    - allows admins to satisfy every defined permission;
 *    - rejects signed-out and inactive-profile callers from the restricted editor sessions query.
 *
 * 4. Editor profile access resolution
 *    - returns a NOT_AUTHENTICATED result for signed-out access;
 *    - returns an admin's real role and complete permissions without requiring a profile;
 *    - returns an active editor's real role and restricted permissions;
 *    - returns NOT_AUTHORIZED for an inactive editor profile;
 *    - returns NOT_AUTHORIZED for an authenticated identity with no editor profile;
 *    - resolves an active editor when Clerk role metadata is missing;
 *    - resolves an active editor when Clerk role metadata is unknown;
 *    - keys profile access by tokenIdentifier rather than Clerk subject.
 *
 * 5. Editor user creation and detail updates
 *    - creates an active profile from a non-admin identity on first sign-in;
 *    - updates an existing active editor's name and email;
 *    - updates an inactive editor's details without reactivating them;
 *    - leaves editor profiles unchanged for admin identities;
 *    - rejects signed-out creation without writing a profile;
 *    - stores empty profile fields when a new identity has no name or email claims.
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
const assignSessionEditor = makeFunctionReference<
	"mutation",
	{ bookingId: Id<"bookings">; editorTokenIdentifier: string; adminNotes: string },
	unknown
>("sessions:assignSessionEditor");
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
type FunctionClient = ReturnType<TestClient["withIdentity"]>;
type TestIds = {
	adjustmentId: Id<"packageAdjustments">;
	bookingId: Id<"bookings">;
	multiBookingId: Id<"multiBookingPackages">;
};

type AdminOperation = {
	name: string;
	permissionLevel: "admin-only" | "editor-granted";
	call: (client: FunctionClient, ids: TestIds) => Promise<unknown>;
};

const bookingEditArgs = {
	name: "Updated name",
	phone: "0400000000",
	accountName: "Updated account",
	email: "updated@example.com",
	date: "2099-01-01",
	time: "10:00",
	duration: "1 hour",
	service: "Remote Podcast",
	addons: []
};

const operations: AdminOperation[] = [
	{
		name: "set a session remaining balance as paid or unpaid",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.mutation(api.sessions.updateSessionPaidStatus, {
				bookingId,
				paidRemainingBalance: true
			})
	},
	{
		name: "mark a package as unpaid",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.markPackageUnpaid, { packageId: multiBookingId })
	},
	{
		name: "confirm a package payment",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.action(api.packagePayment.confirmPackagePayment, { multiBookingId })
	},
	{
		name: "change a package adjustment payment status",
		permissionLevel: "admin-only",
		call: (client, { adjustmentId }) =>
			client.mutation(api.packageAdjustments.markPackageAdjustmentPaymentStatus, {
				adjustmentId,
				paid: true
			})
	},
	{
		name: "change the booking availability windows",
		permissionLevel: "admin-only",
		call: (client) =>
			client.mutation(api.bookingSettings.update, {
				eventBufferMinutes: 15,
				leadTimeMinutes: 60,
				maxDaysAhead: 90,
				weekSchedule: [{ startTime: "09:00", endTime: "17:00" }]
			})
	},
	{
		name: "edit a session",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.updateSessionFromAdmin, { bookingId, ...bookingEditArgs })
	},
	{
		name: "edit a package",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.updatePackageFromAdmin, {
				multiBookingId,
				name: "Updated name",
				phone: "0400000000",
				accountName: "Updated account",
				email: "updated@example.com",
				duration: "1 hour",
				addons: [],
				packageSize: 4
			})
	},
	{
		name: "delete a session Calendar event",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.deleteSessionFromAdmin, { bookingId })
	},
	{
		name: "archive a session",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.mutation(api.sessions.archiveSession, { bookingId, archived: true })
	},
	{
		name: "archive a package",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.mutation(api.packages.archivePackage, { multiBookingId, archived: true })
	},
	{
		name: "send a deliverables email",
		permissionLevel: "editor-granted",
		call: (client, { bookingId }) =>
			client.action(api.deliverablesEmail.sendSessionDeliverablesEmail, { bookingId })
	},
	{
		name: "send a session invoice email",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.action(api.googleCalendar.sendBookingInvoiceForBooking, { bookingId })
	},
	{
		name: "send a package invoice email",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.action(api.packagePayment.resendPackageInvoiceEmail, { multiBookingId })
	},
	{
		name: "generate a new reschedule link",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.mutation(api.sessionReschedule.createAdminRescheduleLink, { bookingId })
	},
	{
		name: "create a session custom invoice",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.mutation(api.customInvoices.createCustomInvoice, {
				bookingId,
				addons: [],
				includeDepositLineItem: false
			})
	},
	{
		name: "create a package custom invoice",
		permissionLevel: "admin-only",
		call: (client, { multiBookingId }) =>
			client.mutation(api.customInvoices.createPackageCustomInvoice, {
				multiBookingId,
				addons: [],
				packageSize: 4,
				includeDepositLineItem: false
			})
	},
	{
		name: "assign an editor to a session",
		permissionLevel: "admin-only",
		call: (client, { bookingId }) =>
			client.mutation(assignSessionEditor, {
				bookingId,
				editorTokenIdentifier: editorMetadataIdentity.tokenIdentifier,
				adminNotes: ""
			})
	},
	{
		name: "invite a user",
		permissionLevel: "admin-only",
		call: (client) =>
			client.action(api.employeeInvitations.inviteUser, { email: "invitee@example.com" })
	}
];

describe.each(identities)("admin operations reject $label", ({ identity, reason }) => {
	test.each(operations)("$name without side effects", async (operation) => {
		const t = createConvexTest();
		const ids = await createTestRecords(t);
		const before = await readTestRecords(t, ids);
		const client = identity === null ? t : t.withIdentity(identity);

		const result = await operation.call(client, ids);

		expect(result).toEqual([{ reason }, null]);
		expect(await readTestRecords(t, ids)).toEqual(before);
	});
});

describe("admin-only operations reject active editors", () => {
	test.each(operations.filter(({ permissionLevel }) => permissionLevel === "admin-only"))(
		"$name without side effects",
		async (operation) => {
			const t = createConvexTest();
			await seedEditorProfile(t, editorMetadataIdentity, true);
			const ids = await createTestRecords(t);
			const before = await readTestRecords(t, ids);

			const result = await operation.call(t.withIdentity(editorMetadataIdentity), ids);

			expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
			expect(await readTestRecords(t, ids)).toEqual(before);
		}
	);
});

async function createTestRecords(t: TestClient): Promise<TestIds> {
	return await t.run(async (ctx) => {
		const multiBookingId = await ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "test@example.com",
			duration: "1 hour",
			addons: [],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 0,
			discountAmount: 0,
			totalDueAmount: 400,
			status: "paid",
			createdAt: 1,
			invoiceDueAt: 2,
			paidAt: 3,
			invoiceEmailStatus: "sent"
		});
		const bookingId = await ctx.db.insert("bookings", {
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
		});
		const adjustmentId = await ctx.db.insert("packageAdjustments", {
			outcome: "invoice_required",
			multiBookingId,
			trigger: "all_sessions_completed",
			remotePodcastBookingIds: [bookingId],
			quantity: 1,
			rate: 100,
			totalAmount: 100,
			invoiceNumber: "TEST-1",
			createdAt: 1,
			invoiceDueAt: 2,
			invoiceEmailStatus: "sent",
			paymentStatus: "unpaid"
		});

		return { adjustmentId, bookingId, multiBookingId };
	});
}

async function readTestRecords(t: TestClient, ids: TestIds) {
	return await t.run(async (ctx) => ({
		adjustment: await ctx.db.get(ids.adjustmentId),
		booking: await ctx.db.get(ids.bookingId),
		bookingSettings: await ctx.db.query("bookingSettings").collect(),
		customInvoices: await ctx.db.query("customInvoices").collect(),
		multiBooking: await ctx.db.get(ids.multiBookingId),
		rescheduleLinks: await ctx.db.query("bookingRescheduleLinks").collect()
	}));
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

		expect(result).toEqual([null, { role: "admin", permissions: PERMISSIONS }]);
	});

	test("reports an active editor's real role and restricted permissions", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);

		const result = await t
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([null, { role: "editor", permissions: ROLE_PERMISSIONS.editor }]);
	});

	test("denies an inactive editor profile", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, false);

		const result = await t
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});

	test("denies an authenticated identity with no editor profile", async () => {
		const result = await createConvexTest()
			.withIdentity(editorMetadataIdentity)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});

	test("resolves an active editor when Clerk role metadata is missing", async () => {
		const identity = { ...editorMetadataIdentity, publicMetadata: undefined };
		const t = createConvexTest();
		await seedEditorProfile(t, identity, true);

		const result = await t.withIdentity(identity).query(api.auth.getCurrentUserAccess, {});

		expect(result).toMatchObject([null, { role: "editor" }]);
	});

	test("resolves an active editor when Clerk role metadata is unknown", async () => {
		const identity = { ...editorMetadataIdentity, publicMetadata: { role: "unexpected-role" } };
		const t = createConvexTest();
		await seedEditorProfile(t, identity, true);

		const result = await t.withIdentity(identity).query(api.auth.getCurrentUserAccess, {});

		expect(result).toMatchObject([null, { role: "editor" }]);
	});

	test("keys profile access by tokenIdentifier rather than Clerk subject", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);
		const identityWithReusedSubject = {
			...editorMetadataIdentity,
			tokenIdentifier: "https://clerk.example|different-editor"
		};

		const result = await t
			.withIdentity(identityWithReusedSubject)
			.query(api.auth.getCurrentUserAccess, {});

		expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});
});

describe("editor user creation and detail updates", () => {
	test("creates an active editor profile on first sign-in", async () => {
		const t = createConvexTest();
		const identity = {
			...editorMetadataIdentity,
			name: "First Editor",
			email: "first@example.com"
		};

		const result = await t.withIdentity(identity).mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([null, null]);
		expect(await findEditorProfile(t, identity.tokenIdentifier)).toMatchObject({
			tokenIdentifier: identity.tokenIdentifier,
			displayName: "First Editor",
			email: "first@example.com",
			isActive: true,
			totalEdits: 0
		});
	});

	test("updates an existing active editor details", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, true);
		const identity = {
			...editorMetadataIdentity,
			name: "Updated Editor",
			email: "updated@example.com"
		};

		const result = await t.withIdentity(identity).mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([null, null]);
		expect(await findEditorProfile(t, identity.tokenIdentifier)).toMatchObject({
			displayName: "Updated Editor",
			email: "updated@example.com",
			isActive: true
		});
	});

	test("updates inactive editor details without reactivating the editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorMetadataIdentity, false);
		const identity = {
			...editorMetadataIdentity,
			name: "Inactive Editor",
			email: "inactive@example.com"
		};

		const result = await t.withIdentity(identity).mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([null, null]);
		expect(await findEditorProfile(t, identity.tokenIdentifier)).toMatchObject({
			displayName: "Inactive Editor",
			email: "inactive@example.com",
			isActive: false
		});
	});

	test("does not create an editor profile for an admin identity", async () => {
		const t = createConvexTest();

		const result = await t.withIdentity(adminIdentity).mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([null, null]);
		expect(await findEditorProfile(t, adminIdentity.tokenIdentifier)).toBeNull();
	});

	test("rejects signed-out creation without writing a profile", async () => {
		const t = createConvexTest();

		const result = await t.mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([{ reason: "NOT_AUTHENTICATED" }, null]);
		expect(await t.run((ctx) => ctx.db.query("editorProfiles").collect())).toEqual([]);
	});

	test("creates empty profile fields when identity claims are absent", async () => {
		const t = createConvexTest();

		const result = await t
			.withIdentity(editorMetadataIdentity)
			.mutation(api.auth.createEditorUser, {});

		expect(result).toEqual([null, null]);
		expect(await findEditorProfile(t, editorMetadataIdentity.tokenIdentifier)).toMatchObject({
			displayName: "",
			email: "",
			isActive: true
		});
	});
});

async function findEditorProfile(t: TestClient, tokenIdentifier: string) {
	return await t.run((ctx) =>
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", tokenIdentifier))
			.unique()
	);
}

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

	test("allows admins every permission", async () => {
		for (const permission of PERMISSIONS) {
			const result = await createConvexTest()
				.withIdentity(adminIdentity)
				.run((ctx) => requirePermission(ctx, permission).match(tupleOk, tupleErr));

			expect(result).toMatchObject([null, adminIdentity]);
		}
	});
});
