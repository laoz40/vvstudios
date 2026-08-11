/**
 * Editor dashboard tests:
 * 1. An admin can assign an active editor to a previously unassigned booking.
 * 2. Assignment rejects an inactive editor and leaves the booking unassigned.
 * 3. An editor receives only their own assigned bookings, not unassigned or another editor's.
 * 4. An editor receives only confirmed and email-failed bookings that are not archived.
 * 5. The editor query returns useful session fields and add-ons without restricted data.
 * 6. The existing admin query continues to return every booking with its sensitive fields.
 * 7. An editor can update deliverables status for an assigned, confirmed past session.
 * 8. An editor cannot update deliverables status for a future session.
 * 9. An editor cannot update deliverables status for an archived session.
 * 10. An editor cannot update deliverables status for an unconfirmed session.
 * 11. An editor cannot update deliverables status for an unassigned session.
 * 12. An editor cannot update another editor's session deliverables status.
 * 13. An admin can update an eligible session without an editor assignment.
 * 14. An admin cannot bypass deliverables eligibility requirements.
 * 15. An admin can reassign a booking from one active editor to another.
 * 16. An admin can unassign a booking without deleting its editor profiles.
 * 17. An editor cannot assign a booking.
 * 18. An editor cannot reassign a booking.
 * 19. An editor cannot unassign a booking.
 * 20. The active-editor list returns only active profiles to admins.
 * 21. Editors cannot list editor identities.
 * 22. Admin session access remains unchanged after assign, reassign, and unassign operations.
 * 23. Admin editor management lists active and deactivated editors with workload details.
 * 24. Deactivation immediately blocks editor queries while retaining assignments.
 * 25. Signing in again does not reactivate a deactivated editor.
 * 26. An admin can reactivate an editor and restore access.
 * 27. Editors cannot manage another editor's access.
 * 28. Reassignment records the receiving editor's latest assignment timestamp.
 * 29. An admin can save and clear private notes for an editor.
 * 30. Editors cannot update another editor's private notes.
 * 31. Assignment rejects cancelled, unconfirmed, and archived sessions.
 * 32. Existing assignments can be removed after a session becomes ineligible.
 * 33. Total edits starts at zero and increments when an assigned session becomes completed.
 */
import type { UserIdentity } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

type TestClient = ReturnType<typeof createConvexTest>;
type BookingStatus =
	| "pending_payment"
	| "confirmed"
	| "cancelled"
	| "failed"
	| "email_failed"
	| "expired"
	| "abandoned";

type AssignSessionEditorArgs = { bookingId: Id<"bookings">; editorTokenIdentifier: string | null };
type AssignmentError = {
	reason: "EDITOR_NOT_ACTIVE" | "NOT_AUTHORIZED" | "SESSION_NOT_ASSIGNABLE";
};
type AssignmentResult = [AssignmentError | null, null];
type ActiveEditor = { tokenIdentifier: string; displayName: string; email: string };
type ManagedEditor = ActiveEditor & {
	isActive: boolean;
	lastAssignedAt: number | null;
	notes?: string;
	totalEdits: number;
	workStatus: "assigned" | "editing" | "unassigned";
};
type ListEditorsResult = [{ reason: string } | null, ManagedEditor[] | null];
type UpdateEditorAccessResult = [{ reason: string } | null, null];
type UpdateSessionEditStatusArgs = {
	bookingId: Id<"bookings">;
	editStatus: "to_edit" | "editing" | "completed";
};
type UpdateSessionEditStatusResult = [{ reason: string } | null, null];
type EditorSessionProjection = {
	_id: Id<"bookings">;
	name: string;
	accountName: string;
	notes?: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	editStatus?: "to_edit" | "editing" | "completed";
};
type EditorSessionsResult = {
	page: EditorSessionProjection[];
	isDone: boolean;
	continueCursor: string;
};

const assignSessionEditor = makeFunctionReference<
	"mutation",
	AssignSessionEditorArgs,
	AssignmentResult
>("sessions:assignSessionEditor");
const listEditorSessions = makeFunctionReference<
	"query",
	{ paginationOpts: { cursor: string | null; numItems: number } },
	EditorSessionsResult
>("sessions:listEditorSessions");
const listActiveEditors = makeFunctionReference<"query", Record<string, never>, ActiveEditor[]>(
	"sessions:listActiveEditors"
);
const listEditors = makeFunctionReference<"query", Record<string, never>, ListEditorsResult>(
	"editors:listEditors"
);
const updateEditorNotes = makeFunctionReference<
	"mutation",
	{ tokenIdentifier: string; notes: string },
	UpdateEditorAccessResult
>("editors:updateEditorNotes");
const updateEditorAccess = makeFunctionReference<
	"mutation",
	{ tokenIdentifier: string; isActive: boolean },
	UpdateEditorAccessResult
>("editors:updateEditorAccess");
const updateSessionEditStatus = makeFunctionReference<
	"mutation",
	UpdateSessionEditStatusArgs,
	UpdateSessionEditStatusResult
>("sessions:updateSessionEditStatus");
const paginationOpts = { cursor: null, numItems: 20 };

const adminIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|admin",
	subject: "admin",
	issuer: "https://clerk.example",
	publicMetadata: { role: "admin" }
};
const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-one",
	subject: "editor-one",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};
const otherEditorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-two",
	subject: "editor-two",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

async function seedEditorProfile(
	t: TestClient,
	identity: UserIdentity,
	isActive = true
): Promise<void> {
	await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName: identity.name ?? identity.subject,
			email: identity.email ?? `${identity.subject}@example.com`,
			isActive,
			lastAssignedAt: null,
			totalEdits: 0
		});
	});
}

async function seedBooking(
	t: TestClient,
	name: string,
	options: {
		hidden?: boolean;
		status?: BookingStatus;
		sessionStartAt?: number;
		assignedEditorTokenIdentifier?: string;
	} = {}
): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name,
			phone: "0400 000 000",
			accountName: `${name} Pty Ltd`,
			abn: "12 345 678 901",
			email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
			instagramHandle: `@${name.toLowerCase().replaceAll(" ", "")}`,
			date: "2030-02-03",
			time: "10:30",
			sessionStartAt: options.sessionStartAt ?? Date.parse("2030-02-02T23:30:00.000Z"),
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [
				"Essential Edit",
				"Clips Package",
				"Teleprompter",
				"4K UHD Recording",
				"Remote Podcast",
				"Internal Billing Add-on"
			],
			essentialEditQuantity: "2",
			clipsPackageQuantity: "3",
			notes: `${name} production notes`,
			status: options.status ?? "confirmed",
			pendingPaymentCreatedAt: Date.parse("2030-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: options.assignedEditorTokenIdentifier,
			paidRemainingBalance: false,
			remainingBalanceAmount: 150,
			editStatus: "editing",
			stripeSessionId: `stripe-${name}`,
			stripePaymentIntentId: `payment-${name}`,
			googleEventId: `event-${name}`,
			googleCalendarId: `calendar-${name}`,
			hiddenAt: options.hidden ? Date.parse("2030-01-02T00:00:00.000Z") : undefined
		})
	);
}

async function assignBooking(
	t: TestClient,
	bookingId: Id<"bookings">,
	identity: UserIdentity = editorIdentity
): Promise<AssignmentResult> {
	return await t
		.withIdentity(adminIdentity)
		.mutation(assignSessionEditor, { bookingId, editorTokenIdentifier: identity.tokenIdentifier });
}

async function unassignBooking(
	t: TestClient,
	bookingId: Id<"bookings">
): Promise<AssignmentResult> {
	return await t
		.withIdentity(adminIdentity)
		.mutation(assignSessionEditor, { bookingId, editorTokenIdentifier: null });
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}

async function updateDeliverablesStatus(
	t: TestClient,
	identity: UserIdentity,
	bookingId: Id<"bookings">
): Promise<UpdateSessionEditStatusResult> {
	return await t
		.withIdentity(identity)
		.mutation(updateSessionEditStatus, { bookingId, editStatus: "completed" });
}

async function expectDeliverablesUpdateRejected(
	t: TestClient,
	identity: UserIdentity,
	bookingId: Id<"bookings">
): Promise<void> {
	const [error, value] = await updateDeliverablesStatus(t, identity, bookingId);
	if (error === null) throw new Error("Expected the deliverables update to be rejected");

	expect(typeof error.reason).toBe("string");
	expect(value).toBeNull();
	expect(await readBooking(t, bookingId)).toMatchObject({ editStatus: "editing" });
}

describe("editor assignment", () => {
	test("allows an admin to assign an active editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Assigned Customer");

		expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
		expect(await assignBooking(t, bookingId)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
	});

	test("rejects assignment to an inactive editor without changing the booking", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity, false);
		const bookingId = await seedBooking(t, "Inactive Editor Customer");

		const result = await assignBooking(t, bookingId);

		expect(result).toEqual([{ reason: "EDITOR_NOT_ACTIVE" }, null]);
		expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
	});

	test("rejects assignments for cancelled, unconfirmed, or archived sessions", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const ineligibleBookingIds = await Promise.all([
			seedBooking(t, "Cancelled Assignment", { status: "cancelled" }),
			seedBooking(t, "Pending Assignment", { status: "pending_payment" }),
			seedBooking(t, "Archived Assignment", { hidden: true })
		]);

		for (const bookingId of ineligibleBookingIds) {
			expect(await assignBooking(t, bookingId)).toEqual([
				{ reason: "SESSION_NOT_ASSIGNABLE" },
				null
			]);
			expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
		}
	});

	test("allows an ineligible session's existing assignment to be removed", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Archived Existing Assignment", {
			hidden: true,
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(await unassignBooking(t, bookingId)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
	});

	test("allows an admin to reassign a booking to another active editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);
		const bookingId = await seedBooking(t, "Reassigned Customer", {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(await assignBooking(t, bookingId, otherEditorIdentity)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			assignedEditorTokenIdentifier: otherEditorIdentity.tokenIdentifier
		});
	});

	test("allows an admin to unassign a booking without deleting editor profiles", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Unassigned Customer", {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(await unassignBooking(t, bookingId)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
		expect(await t.run((ctx) => ctx.db.query("editorProfiles").collect())).toHaveLength(1);
	});

	test.each([
		{ label: "assign", editorTokenIdentifier: otherEditorIdentity.tokenIdentifier },
		{ label: "reassign", editorTokenIdentifier: otherEditorIdentity.tokenIdentifier },
		{ label: "unassign", editorTokenIdentifier: null }
	])("rejects an editor attempt to $label a booking", async ({ label, editorTokenIdentifier }) => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);
		const initiallyAssigned = label === "reassign" || label === "unassign";
		const bookingId = await seedBooking(t, `Editor ${label} attempt`, {
			assignedEditorTokenIdentifier: initiallyAssigned ? editorIdentity.tokenIdentifier : undefined
		});

		const result = await t
			.withIdentity(editorIdentity)
			.mutation(assignSessionEditor, { bookingId, editorTokenIdentifier });

		expect(result).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(await readBooking(t, bookingId)).toMatchObject(
			initiallyAssigned
				? { assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier }
				: { name: `Editor ${label} attempt` }
		);
		if (!initiallyAssigned) {
			expect(await readBooking(t, bookingId)).not.toHaveProperty("assignedEditorTokenIdentifier");
		}
	});
});

describe("active editor assignment options", () => {
	test("returns only active editor profiles to an admin", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity, false);

		const result = await t.withIdentity(adminIdentity).query(listActiveEditors, {});

		expect(result).toEqual([
			{
				tokenIdentifier: editorIdentity.tokenIdentifier,
				displayName: editorIdentity.subject,
				email: `${editorIdentity.subject}@example.com`
			}
		]);
	});

	test("does not expose editor identities to an editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);

		await expect(t.withIdentity(editorIdentity).query(listActiveEditors, {})).rejects.toMatchObject(
			{ data: { reason: "NOT_AUTHORIZED" } }
		);
	});

	test("keeps admin session access unchanged across assignment changes", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);
		const bookingId = await seedBooking(t, "Assignment History Customer");

		async function expectAdminCanReadSession() {
			const result = await t
				.withIdentity(adminIdentity)
				.query(api.sessions.listSessions, { paginationOpts });
			expect(result.page).toEqual(
				expect.arrayContaining([expect.objectContaining({ _id: bookingId })])
			);
		}

		await expectAdminCanReadSession();
		expect(await assignBooking(t, bookingId)).toEqual([null, null]);
		await expectAdminCanReadSession();
		expect(await assignBooking(t, bookingId, otherEditorIdentity)).toEqual([null, null]);
		await expectAdminCanReadSession();
		expect(await unassignBooking(t, bookingId)).toEqual([null, null]);
		await expectAdminCanReadSession();
	});
});

describe("editor access management", () => {
	test("lists all editors with access, assignment time, and workload status", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity, false);
		const bookingId = await seedBooking(t, "Editing Work");
		await assignBooking(t, bookingId);

		const [error, editors] = await t.withIdentity(adminIdentity).query(listEditors, {});

		expect(error).toBeNull();
		if (editors === null) throw new Error("Expected managed editors");
		const activeEditor = editors.find(
			(editor) => editor.tokenIdentifier === editorIdentity.tokenIdentifier
		);
		const inactiveEditor = editors.find(
			(editor) => editor.tokenIdentifier === otherEditorIdentity.tokenIdentifier
		);
		expect(activeEditor).toMatchObject({ isActive: true, totalEdits: 0, workStatus: "editing" });
		expect(typeof activeEditor?.lastAssignedAt).toBe("number");
		expect(inactiveEditor).toMatchObject({
			isActive: false,
			totalEdits: 0,
			workStatus: "unassigned"
		});
	});

	test("increments total edits when an assigned session becomes completed", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Completed Edit", {
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z")
		});
		await assignBooking(t, bookingId);

		let [, editors] = await t.withIdentity(adminIdentity).query(listEditors, {});
		expect(editors?.[0]?.totalEdits).toBe(0);

		await updateDeliverablesStatus(t, editorIdentity, bookingId);
		await updateDeliverablesStatus(t, editorIdentity, bookingId);

		[, editors] = await t.withIdentity(adminIdentity).query(listEditors, {});
		expect(editors?.[0]?.totalEdits).toBe(1);
	});

	test("immediately blocks a deactivated editor while retaining assignments", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Retained Assignment", {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(
			await t
				.withIdentity(adminIdentity)
				.mutation(updateEditorAccess, {
					tokenIdentifier: editorIdentity.tokenIdentifier,
					isActive: false
				})
		).toEqual([null, null]);
		await expect(
			t.withIdentity(editorIdentity).query(listEditorSessions, { paginationOpts })
		).rejects.toMatchObject({ data: { reason: "NOT_AUTHORIZED" } });
		expect(await readBooking(t, bookingId)).toMatchObject({
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});
	});

	test("does not reactivate a deactivated editor when their sign-in details refresh", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity, false);

		expect(await t.withIdentity(editorIdentity).mutation(api.auth.createEditorUser, {})).toEqual([
			null,
			null
		]);
		const editor = await t.run((ctx) =>
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorIdentity.tokenIdentifier)
				)
				.unique()
		);
		expect(editor?.isActive).toBe(false);
	});

	test("allows an admin to reactivate an editor and restore access", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity, false);
		await seedBooking(t, "Restored Assignment", {
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(
			await t
				.withIdentity(adminIdentity)
				.mutation(updateEditorAccess, {
					tokenIdentifier: editorIdentity.tokenIdentifier,
					isActive: true
				})
		).toEqual([null, null]);
		const result = await t
			.withIdentity(editorIdentity)
			.query(listEditorSessions, { paginationOpts });
		expect(result.page).toHaveLength(1);
	});

	test("rejects editor attempts to manage access", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);

		expect(
			await t
				.withIdentity(editorIdentity)
				.mutation(updateEditorAccess, {
					tokenIdentifier: otherEditorIdentity.tokenIdentifier,
					isActive: false
				})
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});

	test("allows an admin to save and clear private editor notes", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);

		expect(
			await t
				.withIdentity(adminIdentity)
				.mutation(updateEditorNotes, {
					tokenIdentifier: editorIdentity.tokenIdentifier,
					notes: "Prefers short-form editing work"
				})
		).toEqual([null, null]);
		let editor = await t.run((ctx) =>
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorIdentity.tokenIdentifier)
				)
				.unique()
		);
		expect(editor?.notes).toBe("Prefers short-form editing work");

		await t
			.withIdentity(adminIdentity)
			.mutation(updateEditorNotes, {
				tokenIdentifier: editorIdentity.tokenIdentifier,
				notes: "  "
			});
		editor = await t.run((ctx) =>
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorIdentity.tokenIdentifier)
				)
				.unique()
		);
		expect(editor).not.toHaveProperty("notes");
	});

	test("rejects editor attempts to update private editor notes", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);

		expect(
			await t
				.withIdentity(editorIdentity)
				.mutation(updateEditorNotes, {
					tokenIdentifier: otherEditorIdentity.tokenIdentifier,
					notes: "Unauthorized note"
				})
		).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
	});

	test("records the latest assignment time for the receiving editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Timestamped Assignment");

		await assignBooking(t, bookingId);
		const editor = await t.run((ctx) =>
			ctx.db
				.query("editorProfiles")
				.withIndex("by_tokenIdentifier", (query) =>
					query.eq("tokenIdentifier", editorIdentity.tokenIdentifier)
				)
				.unique()
		);
		expect(editor?.lastAssignedAt).toEqual(expect.any(Number));
	});
});

describe("restricted editor session query", () => {
	test("returns only bookings assigned to the requesting editor", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);
		const ownBookingId = await seedBooking(t, "Own Customer");
		const otherBookingId = await seedBooking(t, "Other Customer");
		await seedBooking(t, "Unassigned Customer");
		await assignBooking(t, ownBookingId);
		await assignBooking(t, otherBookingId, otherEditorIdentity);

		const result = await t
			.withIdentity(editorIdentity)
			.query(listEditorSessions, { paginationOpts });

		expect(result.page).toMatchObject([{ _id: ownBookingId, name: "Own Customer" }]);
		expect(result.page.map(({ name }) => name)).toEqual(["Own Customer"]);
	});

	test("returns only eligible confirmed, email-failed, non-archived bookings", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookings = await Promise.all([
			seedBooking(t, "Confirmed Customer", { status: "confirmed" }),
			seedBooking(t, "Email Failed Customer", { status: "email_failed" }),
			seedBooking(t, "Pending Customer", { status: "pending_payment" }),
			seedBooking(t, "Cancelled Customer", { status: "cancelled" }),
			seedBooking(t, "Archived Customer", { hidden: true, status: "confirmed" })
		]);
		for (const bookingId of bookings) await assignBooking(t, bookingId);

		const result = await t
			.withIdentity(editorIdentity)
			.query(listEditorSessions, { paginationOpts });

		expect(result.page.map(({ name }) => name).toSorted()).toEqual([
			"Confirmed Customer",
			"Email Failed Customer"
		]);
	});

	test("returns useful row fields without restricted booking data", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Safe Projection Customer");
		await assignBooking(t, bookingId);

		const result = await t
			.withIdentity(editorIdentity)
			.query(listEditorSessions, { paginationOpts });
		expect(result).toMatchObject({
			page: [
				{
					_id: bookingId,
					name: "Safe Projection Customer",
					accountName: "Safe Projection Customer Pty Ltd",
					notes: "Safe Projection Customer production notes",
					date: "2030-02-03",
					time: "10:30",
					duration: "1 hour",
					service: "Remote Podcast",
					addons: [
						"Essential Edit",
						"Clips Package",
						"Teleprompter",
						"4K UHD Recording",
						"Remote Podcast",
						"Internal Billing Add-on"
					],
					essentialEditQuantity: "2",
					clipsPackageQuantity: "3",
					editStatus: "editing"
				}
			]
		});

		const serializedResult = JSON.stringify(result);
		for (const restrictedValue of [
			"0400 000 000",
			"12 345 678 901",
			"safe.projection.customer@example.com",
			"@safeprojectioncustomer",
			"stripe-Safe Projection Customer",
			"payment-Safe Projection Customer",
			"event-Safe Projection Customer",
			"calendar-Safe Projection Customer",
			"remainingBalanceAmount",
			"paidRemainingBalance",
			"multiBookingPackageId"
		]) {
			expect(serializedResult).not.toContain(restrictedValue);
		}
	});

	test("keeps the existing admin query complete and unrestricted", async () => {
		const t = createConvexTest();
		await seedBooking(t, "Admin Confirmed Customer", { status: "confirmed" });
		await seedBooking(t, "Admin Pending Customer", { status: "pending_payment" });
		await seedBooking(t, "Admin Archived Customer", { hidden: true, status: "cancelled" });

		const result = await t
			.withIdentity(adminIdentity)
			.query(api.sessions.listSessions, { paginationOpts });

		expect(result.page).toHaveLength(3);
		expect(result.page).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Admin Confirmed Customer",
					phone: "0400 000 000",
					abn: "12 345 678 901",
					remainingBalanceAmount: 150
				}),
				expect.objectContaining({ name: "Admin Pending Customer" }),
				expect.objectContaining({ name: "Admin Archived Customer" })
			])
		);
	});
});

describe("deliverables status authorization", () => {
	test("allows an editor to update an assigned, confirmed past session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Eligible Editor Session", {
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		expect(await updateDeliverablesStatus(t, editorIdentity, bookingId)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({ editStatus: "completed" });
	});

	test("rejects an editor update for a future session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Future Editor Session", {
			sessionStartAt: Date.parse("2100-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		await expectDeliverablesUpdateRejected(t, editorIdentity, bookingId);
	});

	test("rejects an editor update for an archived session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Archived Editor Session", {
			hidden: true,
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		await expectDeliverablesUpdateRejected(t, editorIdentity, bookingId);
	});

	test("rejects an editor update for an unconfirmed session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Pending Editor Session", {
			status: "pending_payment",
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: editorIdentity.tokenIdentifier
		});

		await expectDeliverablesUpdateRejected(t, editorIdentity, bookingId);
	});

	test("rejects an editor update for an unassigned session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Unassigned Editor Session", {
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z")
		});

		await expectDeliverablesUpdateRejected(t, editorIdentity, bookingId);
	});

	test("rejects an editor update for another editor's session", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		await seedEditorProfile(t, otherEditorIdentity);
		const bookingId = await seedBooking(t, "Other Editor Session", {
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z"),
			assignedEditorTokenIdentifier: otherEditorIdentity.tokenIdentifier
		});

		await expectDeliverablesUpdateRejected(t, editorIdentity, bookingId);
	});

	test("allows an admin to update an eligible unassigned session", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, "Eligible Admin Session", {
			sessionStartAt: Date.parse("2020-01-01T00:00:00.000Z")
		});

		expect(await updateDeliverablesStatus(t, adminIdentity, bookingId)).toEqual([null, null]);
		expect(await readBooking(t, bookingId)).toMatchObject({ editStatus: "completed" });
	});

	test("does not let an admin bypass session eligibility", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, "Future Admin Session", {
			sessionStartAt: Date.parse("2100-01-01T00:00:00.000Z")
		});

		await expectDeliverablesUpdateRejected(t, adminIdentity, bookingId);
	});
});
