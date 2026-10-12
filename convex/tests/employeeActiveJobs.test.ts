/**
 * Employee active jobs API tests:
 *
 * 1. Active job filtering and roster count
 *    The admin details query and roster count include only assigned, unfinished jobs after the
 *    studio session ends, including archived sessions and failed confirmation emails.
 * 2. Complete indexed results
 *    Active job details and counts include every matching assignment beyond the old 500-row cap.
 * 3. Admin access
 *    Editors cannot read another editor's active jobs or the admin roster.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { createConvexTest } from "#convex/test.setup";

const adminIdentity = { publicMetadata: { role: "admin" } };

const editorIdentity = {
	tokenIdentifier: "https://clerk.example|active-jobs-editor",
	subject: "active-jobs-editor",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

const editorTokenIdentifier = editorIdentity.tokenIdentifier;

async function seedEditor(t: ReturnType<typeof createConvexTest>) {
	await t.run((ctx) =>
		ctx.db.insert("editorProfiles", {
			tokenIdentifier: editorTokenIdentifier,
			displayName: "Active Jobs Editor",
			email: "active-jobs@example.com",
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		})
	);
}

async function seedAssignedBooking(
	t: ReturnType<typeof createConvexTest>,
	name: string,
	options: {
		status?: "confirmed" | "email_failed" | "cancelled" | "pending_payment";
		editStatus?: "to_edit" | "editing" | "review" | "completed";
		sessionStartAt?: number;
		archived?: boolean;
		assigned?: boolean;
		assignedTokenIdentifier?: string;
	} = {}
) {
	const now = Date.now();

	return await t.run((ctx) =>
		ctx.db.insert(
			"bookings",
			bookingDocument({
				name,
				phone: "0400000000",
				accountName: `${name} Pty Ltd`,
				email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
				date: "2020-01-01",
				time: "10:00",
				sessionStartAt: options.sessionStartAt ?? now - 2 * 60 * 60 * 1000,
				duration: "1h",
				service: "Remote Podcast",
				addons: ["Essential Edit"],
				essentialEditQuantity: "2",
				completeEditQuantity: "1",
				clipsPackageQuantity: "3",
				handcraftedClipsQuantity: "4",
				status: options.status ?? "confirmed",
				archived: options.archived ?? false,
				pendingPaymentCreatedAt: now - 3 * 60 * 60 * 1000,
				assignedEditorTokenIdentifier:
					options.assigned === false
						? undefined
						: (options.assignedTokenIdentifier ?? editorTokenIdentifier),
				assignedEditorDisplayName: "Active Jobs Editor",
				adminNotes: "Admin delivery note",
				editorNotes: "Editor delivery note",
				editStatus: options.editStatus ?? "to_edit"
			})
		)
	);
}

describe("employee active jobs API", () => {
	test("details and roster count include only assigned unfinished jobs after the session ends", async () => {
		const t = createConvexTest();
		await seedEditor(t);

		const includedIds = await Promise.all([
			seedAssignedBooking(t, "Confirmed Editing Job", { editStatus: "editing" }),
			seedAssignedBooking(t, "Archived Email Failed Job", {
				status: "email_failed",
				editStatus: "review",
				archived: true
			})
		]);

		await Promise.all([
			seedAssignedBooking(t, "Session Still Happening", {
				sessionStartAt: Date.now() - 30 * 60 * 1000
			}),
			seedAssignedBooking(t, "Upcoming Session", {
				sessionStartAt: Date.now() + 24 * 60 * 60 * 1000
			}),
			seedAssignedBooking(t, "Already Delivered", { editStatus: "completed" }),
			seedAssignedBooking(t, "Cancelled Session", { status: "cancelled" }),
			seedAssignedBooking(t, "Awaiting Payment", { status: "pending_payment" }),
			seedAssignedBooking(t, "Unassigned Session", { assigned: false }),
			seedAssignedBooking(t, "Another Editor's Job", {
				assignedTokenIdentifier: "https://clerk.example|another-editor"
			})
		]);

		const admin = t.withIdentity(adminIdentity);

		const [jobsError, jobs] = await admin.query(api.employees.admin.listActiveJobs, {
			tokenIdentifier: editorTokenIdentifier
		});

		const [rosterError, roster] = await admin.query(api.employees.admin.listEmployees, {});

		expect(jobsError).toBeNull();
		expect(jobs?.map((job) => job._id)).toEqual(includedIds);
		expect(jobs?.[0]).toMatchObject({
			name: "Confirmed Editing Job",
			accountName: "Confirmed Editing Job Pty Ltd",
			date: "2020-01-01",
			time: "10:00",
			duration: "1h",
			service: "Remote Podcast",
			addons: ["Essential Edit"],
			essentialEditQuantity: "2",
			completeEditQuantity: "1",
			clipsPackageQuantity: "3",
			handcraftedClipsQuantity: "4",
			adminNotes: "Admin delivery note",
			editorNotes: "Editor delivery note",
			editStatus: "editing"
		});
		expect(rosterError).toBeNull();
		expect(roster?.[0]).toMatchObject({ tokenIdentifier: editorTokenIdentifier, activeJobs: 2 });
	});

	test("details and roster count include all matching assignments beyond 500 rows", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const now = Date.now();
		await t.run(async (ctx) => {
			await Promise.all(
				Array.from({ length: 505 }, (_, index) =>
					ctx.db.insert(
						"bookings",
						bookingDocument({
							name: `Historic Job ${index}`,
							phone: "0400000000",
							accountName: `Historic Job ${index} Pty Ltd`,
							email: `historic-job-${index}@example.com`,
							date: "2020-01-01",
							time: "10:00",
							sessionStartAt: now - 2 * 60 * 60 * 1000,
							duration: "1h",
							service: "Remote Podcast",
							addons: [],
							status: "confirmed",
							archived: false,
							pendingPaymentCreatedAt: now - 3 * 60 * 60 * 1000,
							assignedEditorTokenIdentifier: editorTokenIdentifier,
							editStatus: "to_edit"
						})
					)
				)
			);
		});

		const admin = t.withIdentity(adminIdentity);

		const [jobsError, jobs] = await admin.query(api.employees.admin.listActiveJobs, {
			tokenIdentifier: editorTokenIdentifier
		});

		const [rosterError, roster] = await admin.query(api.employees.admin.listEmployees, {});

		expect(jobsError).toBeNull();
		expect(jobs).toHaveLength(505);
		expect(rosterError).toBeNull();
		expect(roster?.[0]).toMatchObject({ activeJobs: 505 });
	});

	test("editors cannot read active jobs or the admin roster", async () => {
		const t = createConvexTest();
		await seedEditor(t);
		const editor = t.withIdentity(editorIdentity);

		const [jobsError, jobs] = await editor.query(api.employees.admin.listActiveJobs, {
			tokenIdentifier: editorTokenIdentifier
		});

		const [rosterError, roster] = await editor.query(api.employees.admin.listEmployees, {});

		expect(jobsError).toEqual({ reason: "NOT_AUTHORIZED" });
		expect(jobs).toBeNull();
		expect(rosterError).toEqual({ reason: "NOT_AUTHORIZED" });
		expect(roster).toBeNull();
	});
});
