/**
 * Editor retirement through the employee access API.
 *
 * 1. Retiring and reactivating an editor
 *    Clears unfinished assignments, preserves completed attribution and employee notes, and does
 *    not restore assignments when access is reactivated.
 */
import { describe, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import { bookingDocument } from "#convex/tests/insertDocumentDefaults";
import { createConvexTest } from "#convex/test.setup";

const adminIdentity = { publicMetadata: { role: "admin" } };

const editorTokenIdentifier = "https://clerk.example|retiring-editor";

describe("employee retirement", () => {
	test("retiring and reactivating an editor keeps only completed attribution", async () => {
		const t = createConvexTest();
		const admin = t.withIdentity(adminIdentity);

		const bookingIds = await t.run(async (ctx) => {
			await ctx.db.insert("editorProfiles", {
				tokenIdentifier: editorTokenIdentifier,
				displayName: "Retiring Editor",
				email: "retiring@example.com",
				isActive: true,
				lastAssignedAt: null,
				totalEdits: 4,
				notes: "Keep these employee notes"
			});

			const statuses = ["to_edit", "editing", "review", "completed"] as const;

			return await Promise.all(
				statuses.map((editStatus, index) =>
					ctx.db.insert(
						"bookings",
						bookingDocument({
							name: `Retirement customer ${index}`,
							phone: `040000000${index}`,
							accountName: `Retirement account ${index}`,
							email: `customer-${index}@example.com`,
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
							assignedEditorDisplayName: "Retiring Editor",
							adminNotes: "Admin handoff note",
							editorNotes: "Session-specific editor note",
							editStatus
						})
					)
				)
			);
		});

		await admin.mutation(api.employees.employees.updateEmployeeAccess, {
			tokenIdentifier: editorTokenIdentifier,
			isActive: false
		});
		await t.finishInProgressScheduledFunctions();

		const retiredBookings = await admin.query(api.sessions.sessions.listSessions, {
			paginationOpts: { cursor: null, numItems: 20 },
			view: "all"
		});

		const retiredRows = retiredBookings.page
			.filter((booking) => bookingIds.includes(booking._id))
			.toSorted((left, right) => left.sessionStartAt - right.sessionStartAt);

		const [employeeError, retiredEmployees] = await admin.query(
			api.employees.employees.listEmployees,
			{}
		);

		expect(
			retiredRows.map(
				({
					assignedEditorTokenIdentifier,
					assignedEditorDisplayName,
					editStatus,
					adminNotes,
					editorNotes
				}) => ({
					assignedEditorTokenIdentifier,
					assignedEditorDisplayName,
					editStatus,
					adminNotes,
					editorNotes
				})
			)
		).toEqual([
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "to_edit",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "editing",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "review",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: editorTokenIdentifier,
				assignedEditorDisplayName: "Retiring Editor",
				editStatus: "completed",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			}
		]);
		expect(employeeError).toBeNull();
		expect(retiredEmployees).toMatchObject([
			{
				tokenIdentifier: editorTokenIdentifier,
				isActive: false,
				notes: "Keep these employee notes"
			}
		]);

		await admin.mutation(api.employees.employees.updateEmployeeAccess, {
			tokenIdentifier: editorTokenIdentifier,
			isActive: true
		});
		await t.finishInProgressScheduledFunctions();

		const reactivatedBookings = await admin.query(api.sessions.sessions.listSessions, {
			paginationOpts: { cursor: null, numItems: 20 },
			view: "all"
		});

		const reactivatedRows = reactivatedBookings.page
			.filter((booking) => bookingIds.includes(booking._id))
			.toSorted((left, right) => left.sessionStartAt - right.sessionStartAt);

		expect(
			reactivatedRows.map(
				({
					assignedEditorTokenIdentifier,
					assignedEditorDisplayName,
					editStatus,
					adminNotes,
					editorNotes
				}) => ({
					assignedEditorTokenIdentifier,
					assignedEditorDisplayName,
					editStatus,
					adminNotes,
					editorNotes
				})
			)
		).toEqual([
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "to_edit",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "editing",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: undefined,
				assignedEditorDisplayName: undefined,
				editStatus: "review",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			},
			{
				assignedEditorTokenIdentifier: editorTokenIdentifier,
				assignedEditorDisplayName: "Retiring Editor",
				editStatus: "completed",
				adminNotes: "Admin handoff note",
				editorNotes: "Session-specific editor note"
			}
		]);
	});
});
